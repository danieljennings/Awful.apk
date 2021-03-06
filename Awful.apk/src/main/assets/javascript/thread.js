'use strict';

/**
 * Initializes the container holding all the posts.
 */
function containerInit() {
	var container = document.getElementById('container');

	// Most click events
	container.addEventListener('click', function containerClick(event) {
		var target = event.target;

		if (findInPath(event, 'toggleread')) {
			showReadPosts();
			return;
		}
		if (findInPath(event, 'posterinfo')) {
			toggleInfo(findInPath(event, 'posterinfo', true));
			return;
		}
		if (findInPath(event, 'postmenu')) {
			showPostMenu(findInPath(event, 'postmenu', true));
			return;
		}
		if (findInPath(event, 'timg')) {
			enlargeTimg(findInPath(event, 'timg', true));
			return;
		}
		if (findInPath(event, 'quote_link')) {
			handleQuoteLink(target, event);
			return;
		}
		if (target.tagName === 'A' && target.href.indexOf('showthread.php?action=showpost') !== -1) {
			loadIgnoredPost(target, event);
			return;
		}
		if (target.tagName === 'IMG' && target.hasAttribute('title') && target.src.endsWith('.gif')) {
			freezeGif(target);
			return;
		}
		if (target.tagName === 'CANVAS' && target.hasAttribute('title') && target.getAttribute('src').endsWith('.gif')) {
			target.outerHTML = '<img src="' + target.getAttribute('src') + '" title="' + target.getAttribute('title') + '" />';
			return;
		}
		if (findInPath(event, 'bbc-spoiler') && listener.getPreference('showSpoilers') !== 'true') {
			findInPath(event, 'bbc-spoiler', true).classList.toggle('spoiled');
		}
	});

	// Some touch events, freezing gifs and blocking side-swiping on code-blocks
	container.addEventListener('touchstart', function touchStartHandler(event) {
		var target = event.target;
		// title popup on long-press
		if ((target.tagName === 'IMG' || target.tagName === 'CANVAS') && target.hasAttribute('title')) {
			Longtap(function longtap() {
				listener.popupText(target.getAttribute('title'));
			})(event);
			return;
		}
		if (target.tagName === 'VIDEO' ) {
			Longtap(function longtap() {
				listener.openUrlMenu(target.firstElementChild.getAttribute('src'));
			})(event);
			return;
		}
		var bbcBlock = findInPath(event, 'bbc-block', true);
		if (bbcBlock && (bbcBlock.classList.contains('pre') || bbcBlock.classList.contains('code') || bbcBlock.classList.contains('php'))) {
			listener.haltSwipe();
			document.addEventListener('touchend', handleTouchLeave);
			document.addEventListener('touchleave', handleTouchLeave);
			document.addEventListener('touchcancel', handleTouchLeave);
		}
	});
	// Auto-starting of videos
	if (listener.getPreference('inlineWebm') === 'true' && listener.getPreference('autostartWebm') === 'true') {
		var debouncedVideosScrollListener = debounce(pauseVideosOutOfView, 250);

		window.addEventListener('scroll', function containerScroll() {
			debouncedVideosScrollListener();
		});
	}

	window.addEventListener('awful-scroll-post', function scrollToPost() {
		window.topScrollID = window.requestAnimationFrame(scrollPost);
	});
}

/**
 * This message tries to find a css class in the path of an event
 * @param {Event} event Initiating user event
 * @param {String} cssClass CSS class that is expected
 * @param {Boolean} returnElement If true returns the found element
 * @returns {Element|undefined} The requested Element or undefined if the Element is not found
 */
function findInPath(event, cssClass, returnElement) {
	var search = Array.prototype.filter.call(event.path, function filter(node) {
		return node.classList && node.classList.contains(cssClass);
	});
	return returnElement ? search[0] : search.length > 0;
}

/**
 * Loads the current thread html into the body container
 */
function loadPageHtml() {
	if (window.topScrollTimeout) {
		window.clearTimeout(window.topScrollTimeout);
		window.cancelAnimationFrame(window.topScrollID);
	}

	window.topScrollItem = null;
	window.topScrollPos = 0;
	window.topScrollCount = 0;
	var html = listener.getBodyHtml();
	document.getElementById('container').innerHTML = html;
	pageInit();
	window.topScrollTimeout = window.setTimeout(function hello() {
		window.dispatchEvent(new Event('awful-scroll-post'));
	}, 1000);
	document.addEventListener('DOMContentLoaded', function updateCssForPage() {
		changeCSS(listener.getCSS());
	});
}

/**
 * Initializes the newly added posts that have just been added to the container
 */
function pageInit() {
	document.querySelectorAll('head script.JSONP').forEach(function removeScripts(script) {
		script.remove();
	});
	var spoilers = document.querySelectorAll('.bbc-spoiler');
	spoilers.forEach(function each(spoiler) {
		spoiler.removeAttribute('onmouseover');
		spoiler.removeAttribute('onmouseout');
		if (listener.getPreference('showSpoilers') === 'true') {
			spoiler.classList.remove('bbc-spoiler');
		}
	});
	// hide-old posts
	if (document.querySelector('.toggleread') !== null) {
		document.querySelectorAll('.read').forEach(function each(post) {
			post.style.display = 'none';
		});
	}
	if (listener.getPreference('hideSignatures') === 'true') {
		document.querySelectorAll('.postcontent .signature').forEach(function each(signature) {
			signature.remove();
		});
	}
	processThreadEmbeds();
	pauseVideosOutOfView();

	if (listener.getPreference('highlightUsername') === 'true') {
		highlightOwnUsername();
	}

	if (listener.getPreference('highlightUserQuote') === 'true') {
		highlightOwnQuotes();
	}

	if (listener.getPreference('disableGifs') === 'true') {
		document.querySelectorAll('img[title][src$=".gif"]').forEach(function each(gif) {
			if (!gif.complete) {
				gif.addEventListener('load', function freezeLoadHandler() {
					freezeGif(this);
				});
			} else {
				freezeGif(gif);
			}
		});
	}
}

/**
 * Eventhandler that pauses all videos that have been scrolled out of the viewport and starts all videos currently in the viewport
 */
function pauseVideosOutOfView() {
	document.querySelectorAll('video').forEach(function eachVideo(video) {
		if (isElementInViewport(video) && video.parentElement.tagName !== 'BLOCKQUOTE' && video.firstElementChild.src.indexOf('webm') === -1) {
			video.play();
		} else {
			video.pause();
		}
	});
}

/**
 * Sets up the scrollUpdate function parameters
 * @param {number} count How many times to try to scroll to the element
 * @param {Element} element The element to scroll to
 */
function setTopScroll(count, element) {
	window.topScrollCount = count;
	window.topScrollItem = element;
	window.topScrollPos = window.topScrollItem.getBoundingClientRect().top + window.scrollY;
	window.scrollTo(0, window.topScrollPos);
	window.topScrollID = requestAnimationFrame(scrollUpdate);
}

/**
 * Scrolls the webview to a certain post or the first unread post
 * @param {String} [postNumber] number of the post to just to
 */
function scrollPost(postNumber) {
	var postjump = postNumber || listener.getPostJump();
	if (postjump !== '') {
		try {
			setTopScroll(200, document.getElementById(postjump));
		} catch (error) {
			scrollLastRead();
		}
		return;
	}
	scrollLastRead();
}

/**
 * Scrolls the webview to the first unread post
 */
function scrollLastRead() {
	try {
		setTopScroll(100, document.querySelector('.unread'));
	} catch (error) {
		window.topScrollCount = 0;
		window.topScrollItem = null;
	}
}

/**
 * Updates the scroll position
 */
function scrollUpdate() {
	try {
		if (window.topScrollCount > 0 && window.topScrollItem) {
			var newPosition = window.topScrollItem.getBoundingClientRect().top + window.scrollY;
			if (newPosition - window.topScrollPos > 0) {
				window.scrollBy(0, newPosition - window.topScrollPos);
			}
			window.topScrollPos = newPosition;
			window.topScrollCount--;
			window.topScrollID = requestAnimationFrame(scrollUpdate);
		}
	} catch (error) {
		window.topScrollCount = 0;
		window.topScrollItem = null;
	}
}

/**
 * Makes already read posts visible
 */
function showReadPosts() {
	document.querySelectorAll('.read').forEach(function showAllReadPosts(post) {
		post.style.display = '';
	});
	document.querySelector('.toggleread').remove();
	window.requestAnimationFrame(scrollLastRead);
}

/**
 * Load an image url and replace links with the image. Handles paused gifs and basic text links.
 * @param {String} url The image URL
 */
function showInlineImage(url) {
	var LOADING = 'loading';
	var FROZEN_GIF = 'playGif';

	if (url.startsWith('https://forums.somethingawful.com/attachment.php?')) {
		url = url.split('/')[3];
	}

	/**
	 * Adds an empty Image Element to the Link if the link is not around a gif
	 * @param {Element} link Link Element
	 */
	function addEmptyImg(link) {
		// basically treating anything not marked as a frozen gif as a text link
		if (!link.classList.contains(FROZEN_GIF)) {
			var image = document.createElement('img');
			image.src = '';
			link.appendChild(image);
		} else {
			link.classList.add(LOADING);
		}
	}

	/**
	 * Inlines the loaded image
	 * @param {Element} link The link the image is wrapping
	 */
	function inlineImage(link) {
		var image = link.querySelector('img');
		image.src = url;
		image.style.height = 'auto';
		image.style.width = 'auto';
		link.classList.remove(LOADING);
		link.classList.remove(FROZEN_GIF);
	}
	// skip anything that's already loading/loaded
	var imageLinks = document.querySelectorAll('a[href="' + url + '"]:not(.loading)');
	imageLinks.forEach(addEmptyImg);

	var pseudoImage = document.createElement('img');
	pseudoImage.src = url;
	pseudoImage.addEventListener('load', function loadHandler() {
		// when the image is loaded, inline it everywhere and update the links
		imageLinks.forEach(inlineImage);
		pseudoImage.remove();
	});
}

/**
 * Changes the font-face of the webview
 * @param {String} font The name of the font
 */
function changeFontFace(font) {
	var fontFace = document.getElementById('font-face');
	if (fontFace !== null) {
		fontFace.remove();
	}
	if (font !== 'default') {
		var styleElement = document.createElement('style');
		styleElement.id = 'font-face';
		styleElement.setAttribute('type', 'text/css');
		styleElement.innerHTML = '@font-face { font-family: userselected; src: url(\'content://com.ferg.awfulapp.webprovider/' + font + '\'); }';
		document.getElementsByTagName('head')[0].appendChild(styleElement);
	}
}

/**
 * Paints a gif on a canvas and replaces the original image with the canvas.
 * @param {Element} image Gif image that will be turned into a still canvas
 */
function freezeGif(image) {
	var canvas = document.createElement('canvas');
	var imageWidth = image.naturalWidth;
	var imageHeight = image.naturalHeight;
	canvas.width = image.naturalWidth;
	canvas.height = image.naturalHeight;
	canvas.getContext('2d').drawImage(image, 0, 0, imageWidth, imageHeight);
	// if possible, retain all css aspects
	for (var i = 0; i < image.attributes.length; i++) {
		canvas.setAttribute(image.attributes[i].name, image.attributes[i].value);
	}
	image.parentNode.replaceChild(canvas, image);
}

/**
 * Updates the background color of all posters that were previously, or are now, marked by the user
 * @param {String} users A string of users separated by commas
 */
function updateMarkedUsers(users) {
	document.querySelectorAll('article.marked').forEach(function each(markedPoster) {
		markedPoster.classList.remove('marked');
	});
	var userArray = users.split(',');
	userArray.forEach(function each(username) {
		document.querySelectorAll('.postmenu[username="' + username + '"]').forEach(function each(poster) {
			poster.closest('article').classList.add('marked');
		});
	});
}

/**
 * wait for redraw
 * @param {String} id the id of the post
 */
function waitForRedraw(id) {
	if (document.getElementById(id).style.display === 'none') {
		window.requestAnimationFrame(waitForRedraw.bind(null, id));
		return;
	}
	window.setTimeout(scrollPost.bind(null, id), 500);
}

/**
 * Handles a quote link click event depending on the URL of the link. Moves the webview if the post is on the same page
 * @param {Element} link The HTMLElement of the link
 * @param {Event} event The click-event triggered by the user
 */
function handleQuoteLink(link, event) {
	var id = link.hash.substring(1);
	try {
		var postOfID = document.getElementById(id);
		if (!postOfID) {
			return;
		}
		event.preventDefault();
		if (postOfID.style.display === 'none') {
			var readPosts = document.querySelectorAll('.read');
			document.querySelector('.toggleread').remove();
			readPosts.forEach(function eachPost(readPost) {
				window.requestAnimationFrame(function wait() {
					readPost.style.display = '';
				});
			});
			readPosts[0].offsetHeight;
			window.requestAnimationFrame(waitForRedraw.bind(null, id));
			return;
		}

		scrollPost(id);

	} catch (error) {
		window.console.log(error);
	}
}

/**
 * Expands or retracts the postinfo
 * @param {Element} info The HTMLElement of the postinfo
 */
function toggleInfo(info) {
	if (info.querySelector('.postinfo-title').classList.contains('extended')) {
		if (info.querySelector('.avatar') !== null) {
			if (listener.getPreference('disableGifs') === 'true' && info.querySelector('.avatar').src.endsWith('.gif')) {
				freezeGif(info.querySelector('.avatar'));
				info.querySelector('canvas').classList.add('avatar');
			}
			window.requestAnimationFrame(function shrinkAvatar() {
				info.querySelector('.avatar').classList.remove('extended');
			});
		}
		info.querySelector('.postinfo-title').classList.remove('extended');
		info.querySelector('.postinfo-regdate').classList.remove('extended');
	} else {
		if (info.querySelector('.avatar') !== null) {
			if (info.querySelector('canvas') !== null) {
				var avatar = document.createElement('img');
				avatar.src = info.querySelector('canvas').getAttribute('src');
				avatar.classList.add('avatar');
				info.querySelector('canvas').replaceWith(avatar);
			}
			window.requestAnimationFrame(function enlargeAvatar() {
				info.querySelector('.avatar').classList.add('extended');
			});
		}
		info.querySelector('.postinfo-title').classList.add('extended');
		info.querySelector('.postinfo-regdate').classList.add('extended');
	}
}

/**
 * Triggers the display of the postmenu
 * @param {Element} postMenu The HTMLElement of the postmenu
 */
function showPostMenu(postMenu) {
// temp hack to create the right menu for rap sheet entries without making its own CSS class etc
    if (postMenu.hasAttribute('badPostUrl')) {
    	showPunishmentMenu(postMenu);
    	return;
    }
	listener.onMoreClick(
		postMenu.closest('article').getAttribute('id').replace(/post/, ''),
		postMenu.getAttribute('username'),
		postMenu.getAttribute('userid'),
		postMenu.getAttribute('lastreadurl'),
		postMenu.hasAttribute('editable'),
		postMenu.hasAttribute('isMod') || postMenu.hasAttribute('isAdmin'),
		postMenu.hasAttribute('isPlat')
	);
}


/**
 * Displays the context for a leper's colony punishment
 * @param {Element} menu The HTMLElement of the clicked menu
 */
function showPunishmentMenu(menu) {
	listener.onMoreClick(
		menu.getAttribute('username'),
		menu.getAttribute('userId'),
		menu.getAttribute('badPostUrl'),
		menu.getAttribute('adminUsername'),
		menu.getAttribute('adminId')
	);
}

/**
 * Changes the styling of the webview
 * @param {String} file Name of the CSS to be used
 */
function changeCSS(file) {
	document.getElementById('theme-css').setAttribute('href', file);
}

/**
 * Loads an ignored post
 * @param {Element} post The HTMLElement of the post
 * @param {Event} event User-triggered click event
 */
function loadIgnoredPost(post, event) {
	event.preventDefault();
	var id = post.hash.substring(1);
	listener.loadIgnoredPost(id);
	post.outerHTML = '<span id="ignorePost-' + id + '">Loading Post, please wait...</span>';
}

/**
 * Replaces the previously ignored post with the loaded version
 * @param {String} id The postId of the ignored post
 */
function insertIgnoredPost(id) {
	var ignoredPost = document.getElementById('ignorePost-' + id);
	ignoredPost.innerHTML = listener.getIgnorePostHtml(id);
	processThreadEmbeds(ignoredPost);
}

/**
 * Removes the timg class from a timg to turn it into a normal image
 * @param {Element} tImg The HTMLElement of the timg
 */
function enlargeTimg(tImg) {
	tImg.classList.remove('timg');
	if (tImg.parentElement.tagName !== 'A') {
		var link = document.createElement('a');
		link.href = tImg.src;
		tImg.parentNode.insertBefore(link, tImg);
		tImg.parentNode.removeChild(tImg);
		link.appendChild(tImg);
	}
}

/**
 * Checks whether the supplied Element is currently fully visible in the viewport
 * @param {Element} element The Element that checked for visibility
 * @returns {Boolean} True if the element is in the viewport
 */
function isElementInViewport(element) {

	var rect = element.getBoundingClientRect();

	return (
		rect.top >= 0 &&
		rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
	);
}

/**
 * Highlight the user's username in posts
 */
function highlightOwnUsername() {

	/**
	 * Returns all textnodes inside the element
	 * @param {Element} element Where the text nodes are to be found
	 * @returns {Array} Array of text node Elements
	 */
	function getTextNodesIn(element) {
		var textNodeArray = [];
		var treeWalker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
		while (treeWalker.nextNode()) {
			textNodeArray.push(treeWalker.currentNode);
		}
		return textNodeArray;
	}

	var selector = 'article:not(self) .postcontent';

	var regExp = new RegExp('\\b' + listener.getPreference('username') + '\\b', 'g');
	var styled = '<span class="usernameHighlight">' + listener.getPreference('username') + '</span>';
	document.querySelectorAll(selector).forEach(function eachPost(post) {
		getTextNodesIn(post).forEach(function eachTextNode(node) {
			if (node.wholeText.match(regExp)) {
				var newNode = node.ownerDocument.createElement('span');
				newNode.innerHTML = node.wholeText.replace(regExp, styled);
				node.parentNode.replaceChild(newNode, node);
			}
		});
	});
}

/**
 * Highlight the quotes of the user themselves.
 */
function highlightOwnQuotes() {
	var usernameQuoteMatch = listener.getPreference('username') + ' posted:';
	var quotes = document.querySelectorAll('.bbc-block h4');
	quotes = Array.prototype.filter.call(quotes, function filterQuotes(quote) {
		return quote.innerText === usernameQuoteMatch;
	});
	quotes.forEach(function eachQuote(quote) {
		quote.parentElement.classList.add('self');
		// Replace the styling from username highlighting
		quote.querySelectorAll('.usernameHighlight').forEach(function eachHighlight(name) {
			name.classList.remove('usernameHighlight');
		});
	});
}

/**
 * Debounces a function and returns it. The returned function will call the supplied callback after a predetermined amount of time
 * @param {Function} callback The callback that should be called after the wait time
 * @param {Integer} wait Time to wait in ms
 * @param {Boolean} immediate Run callback immediately if true
 * @returns {Function} Debounced function
 */
function debounce(callback, wait, immediate) {
	var timeout;
	return function debounced() {
		var that = this;
		var args = arguments;

		/**
		 * Function that is called when the timer runs out
		 */
		function later() {
			timeout = null;
			if (!immediate) {
				callback.apply(that, args);
			}
		}
		var callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
		if (callNow) {
			callback.apply(that, args);
		}
	};
}

/**
 * Handles the leaving of the touch event
 */
function handleTouchLeave() {
	listener.resumeSwipe();
	document.removeEventListener('touchend', handleTouchLeave);
	document.removeEventListener('touchleave', handleTouchLeave);
	document.removeEventListener('touchcancel', handleTouchLeave);
}