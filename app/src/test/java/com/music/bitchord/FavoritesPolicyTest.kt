package com.music.bitchord

import com.music.bitchord.data.FavoritesPolicy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The ordering and cleanup rules behind "Canciones favoritas".
 *
 * Kept apart from the store's file I/O on purpose: these are the rules the
 * section's order depends on, and they are the part that has to stay right
 * across versions of the file rather than the part that has to touch a disk.
 */
class FavoritesPolicyTest {

    @Test
    fun `toggle adds an unknown id to the front`() {
        assertEquals(listOf("b", "a"), FavoritesPolicy.toggle(listOf("a"), "b"))
    }

    @Test
    fun `toggle removes a known id`() {
        assertEquals(listOf("b"), FavoritesPolicy.toggle(listOf("a", "b"), "a"))
    }

    @Test
    fun `toggle of the last favourite empties the list`() {
        assertEquals(emptyList<String>(), FavoritesPolicy.toggle(listOf("a"), "a"))
    }

    @Test
    fun `toggle ignores blank ids`() {
        assertEquals(listOf("a"), FavoritesPolicy.toggle(listOf("a"), ""))
        assertEquals(listOf("a"), FavoritesPolicy.toggle(listOf("a"), "   "))
    }

    @Test
    fun `toggle trims surrounding whitespace`() {
        assertEquals(listOf("abc"), FavoritesPolicy.toggle(emptyList(), " abc "))
        assertEquals(emptyList<String>(), FavoritesPolicy.toggle(listOf("abc"), " abc "))
    }

    @Test
    fun `newest favourite comes first`() {
        var ids = emptyList<String>()
        ids = FavoritesPolicy.toggle(ids, "one")
        ids = FavoritesPolicy.toggle(ids, "two")
        ids = FavoritesPolicy.toggle(ids, "three")
        assertEquals(listOf("three", "two", "one"), ids)
    }

    @Test
    fun `toggle never duplicates`() {
        val once = FavoritesPolicy.toggle(emptyList(), "a")
        val twice = FavoritesPolicy.toggle(once, "a")
        assertFalse(twice.contains("a"))
        assertEquals(1, once.size)
    }

    @Test
    fun `add is idempotent and remove is a no-op when absent`() {
        val ids = FavoritesPolicy.add(listOf("a"), "b")
        assertEquals(listOf("b", "a"), ids)
        assertEquals(listOf("b", "a"), FavoritesPolicy.add(ids, "b"))
        assertEquals(listOf("b", "a"), FavoritesPolicy.remove(ids, "zzz"))
        assertEquals(listOf("a"), FavoritesPolicy.remove(ids, "b"))
    }

    @Test
    fun `isFavorite matches exactly`() {
        val ids = listOf("a", "b")
        assertTrue(FavoritesPolicy.isFavorite(ids, "a"))
        assertFalse(FavoritesPolicy.isFavorite(ids, "A"))
        assertFalse(FavoritesPolicy.isFavorite(ids, ""))
    }

    @Test
    fun `sanitize drops blanks nulls and duplicates while preserving order`() {
        val raw = listOf("b", null, "", "  ", "a", "b", " c ")
        assertEquals(listOf("b", "a", "c"), FavoritesPolicy.sanitize(raw))
    }

    @Test
    fun `sanitize caps the list at the limit`() {
        val raw = (0 until FavoritesPolicy.LIMIT + 50).map { "id$it" }
        assertEquals(FavoritesPolicy.LIMIT, FavoritesPolicy.sanitize(raw).size)
    }

    @Test
    fun `toggle caps the list rather than growing without bound`() {
        var ids = (0 until FavoritesPolicy.LIMIT).map { "id$it" }
        ids = FavoritesPolicy.toggle(ids, "fresh")
        assertEquals(FavoritesPolicy.LIMIT, ids.size)
        assertEquals("fresh", ids.first())
    }

    @Test
    fun `reconcile drops ids with no song and keeps the order`() {
        val ids = listOf("c", "a", "zombie", "b")
        assertEquals(listOf("c", "a", "b"), FavoritesPolicy.reconcile(ids, setOf("a", "b", "c")))
    }

    @Test
    fun `reconcile returns the same instance when everything is available`() {
        val ids = listOf("a", "b")
        assertTrue(ids === FavoritesPolicy.reconcile(ids, setOf("a", "b")))
    }

    @Test
    fun `reconcile of an empty list is empty`() {
        assertEquals(emptyList<String>(), FavoritesPolicy.reconcile(emptyList(), setOf("a")))
    }

    @Test
    fun `the input list is never mutated`() {
        val original = listOf("a", "b")
        FavoritesPolicy.toggle(original, "c")
        FavoritesPolicy.remove(original, "a")
        FavoritesPolicy.sanitize(original)
        assertEquals(listOf("a", "b"), original)
    }
}
