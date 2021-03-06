package com.ferg.awfulapp.task

import android.content.Context
import android.net.Uri
import com.ferg.awfulapp.constants.Constants
import com.ferg.awfulapp.task.LepersColonyRequest.LepersColonyPage
import com.ferg.awfulapp.users.LepersColonyFragment.Companion.FIRST_PAGE
import com.ferg.awfulapp.users.Punishment
import com.ferg.awfulapp.util.AwfulError
import org.jsoup.nodes.Document

/**
 * Created by baka kaba on 29/07/2017.
 *
 * Request to load a page from the Leper's Colony or a user's rap sheet, and parse entries as [Punishment]s
 */

class LepersColonyRequest(context: Context, val page: Int = 1, val userId: String? = null):
        AwfulStrippedRequest<LepersColonyPage>(context, Constants.FUNCTION_BANLIST) {

    // allow queued requests to be cancelled when a new one starts, e.g. skipping quickly through pages
    companion object {
        val REQUEST_TAG = Any()
    }
    override fun getRequestTag(): Any = REQUEST_TAG

    override fun generateUrl(urlBuilder: Uri.Builder?): String {
        with(urlBuilder!!) {
            appendQueryParameter(Constants.PARAM_PAGE, page.toString())
            userId?.let { appendQueryParameter(Constants.PARAM_USER_ID, userId) }
            return build().toString()
        }
    }

    override fun handleResponse(doc: Document?): LepersColonyPage? {
        with (doc!!) {
            val thisPage = selectFirst(".pages option[selected]")?.text()?.toIntOrNull() ?: FIRST_PAGE
            val lastPage = selectFirst(".pages a[title='Last page']")
                    ?.attr("href")
                    ?.let(Uri::parse)
                    ?.getQueryParameter(Constants.PARAM_PAGE)
                    ?.toIntOrNull()
                    ?: thisPage

            // get the rap sheet table and turn each row into a Punishment, skipping the header row
            val punishments = select("table.standard.full tr").drop(1).map(Punishment.Companion::parse)
            return LepersColonyPage(punishments, thisPage, lastPage, userId)
        }
    }

    override fun handleStrippedResponse(doc: Document, currentPage: Int?, lastPage: Int?): LepersColonyPage {
        val thisPage = currentPage ?: FIRST_PAGE
        val totalPages = lastPage ?: thisPage
        val punishments = doc.select("table.standard.full tr").drop(1).map(Punishment.Companion::parse)
        return LepersColonyPage(punishments, thisPage, totalPages, userId)
    }

    override fun handleError(error: AwfulError?, doc: Document?) = true

    /**
     * Represents the contents and metadata for a page from the Leper's Colony
     * or a user's rap sheet (if a [userId] is provided)
     */
    data class LepersColonyPage(val punishments: List<Punishment>, val pageNumber: Int, val totalPages: Int, val userId: String?)
}