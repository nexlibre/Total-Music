package com.music.bitchord.data

/**
 * The rules behind "Canciones favoritas", kept free of Android and JSON so they
 * can be read, reasoned about and tested on their own.
 *
 * An id list in favourite order: newest first. That is what the Library section
 * shows, and it is the only ordering that makes a song you just tapped appear
 * where you are looking.
 *
 * The hearts in the players already exist and mean "liked on YouTube". A rating
 * is a remote fact: it needs a signed-in account and a round trip, it says
 * nothing about a file on the device, and it is not available at all for local
 * music. This list is the device-side answer to the same question, so the heart
 * keeps working with no account and covers local files too.
 */
object FavoritesPolicy {

    /**
     * Ceiling on the list.
     *
     * Not a storage limit — a thousand rows is well under a megabyte of JSON —
     * but a bound on what the Library section can be asked to render at once.
     * Trimming from the tail drops the *oldest* favourites, which is the least
     * surprising thing to lose if it ever comes to that.
     */
    const val LIMIT = 1000

    /** Adds when absent, removes when present. Blank ids are ignored. */
    fun toggle(ids: List<String>, id: String): List<String> {
        val clean = id.trim()
        if (clean.isEmpty()) return ids
        if (ids.contains(clean)) return ids.filterNot { it == clean }
        return (listOf(clean) + ids).take(LIMIT)
    }

    /** Idempotent add. */
    fun add(ids: List<String>, id: String): List<String> {
        val clean = id.trim()
        if (clean.isEmpty() || ids.contains(clean)) return ids
        return (listOf(clean) + ids).take(LIMIT)
    }

    /** Idempotent remove. */
    fun remove(ids: List<String>, id: String): List<String> =
        if (ids.contains(id)) ids.filterNot { it == id } else ids

    fun isFavorite(ids: List<String>, id: String): Boolean = ids.contains(id)

    /**
     * Trims, drops blanks and duplicates, and caps the result.
     *
     * Applied to whatever came off disk, because the file is editable and the
     * previous version of it may not have had the same rules.
     */
    fun sanitize(raw: List<String?>): List<String> {
        val seen = HashSet<String>(raw.size)
        val out = ArrayList<String>(raw.size)
        for (value in raw) {
            val id = value?.trim().orEmpty()
            if (id.isEmpty() || !seen.add(id)) continue
            out += id
            if (out.size >= LIMIT) break
        }
        return out
    }

    /**
     * Drops ids this run has no song for — a favourite whose file was deleted,
     * or whose remote track no longer appears.
     *
     * Only ever removes. A song that reappears is re-added by the heart, not by
     * this; guessing it back in would undo the user's removal.
     */
    fun reconcile(ids: List<String>, available: Set<String>): List<String> =
        if (ids.all { it in available }) ids else ids.filter { it in available }

    /** What [available] has that [ids] does not, in favourite order. */
    fun ordered(ids: List<String>, available: Set<String>): List<String> = reconcile(ids, available)
}
