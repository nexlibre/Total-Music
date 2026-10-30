package com.music.bitchord.data

import android.content.Context
import android.util.AtomicFile
import com.music.bitchord.data.model.Song
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * "Canciones favoritas" — the device's own list, independent of any account.
 *
 * Kept beside [DevicePlaylistStore] and written the same way (an [AtomicFile]
 * with the previous version restored on a failed write), because it is the same
 * kind of thing: a small list of tracks the user assembled by hand.
 *
 * Whole [Song] snapshots are stored, not ids. The section in Library has to
 * draw a favourite while the library feed is still loading, while offline, and
 * for local files that no remote catalogue knows about — an id-only list would
 * have nothing to draw in all three cases.
 */
class SongFavoritesStore(context: Context, filename: String = "star-song-favorites.json") {

    companion object {
        private var deviceStore: SongFavoritesStore? = null

        /** One writer and one observable state across every screen. */
        fun forDevice(context: Context): SongFavoritesStore = synchronized(this) {
            deviceStore ?: SongFavoritesStore(context.applicationContext).also { deviceStore = it }
        }
    }

    private val file = AtomicFile(File(context.filesDir, filename))
    private val state = MutableStateFlow(read())

    /** Favourites, newest first. */
    val favorites: StateFlow<List<Song>> = state.asStateFlow()

    private fun read(): List<Song> {
        // openRead restores AtomicFile's backup first; skipping that would lose
        // the list after an interrupted write.
        val input = try {
            file.openRead()
        } catch (e: java.io.FileNotFoundException) {
            if (!file.baseFile.exists()) return emptyList() else throw e
        }
        return runCatching {
            val array = JSONArray(input.use { it.readBytes().toString(Charsets.UTF_8) })
            val songs = (0 until array.length()).map { i -> array.getJSONObject(i).toSong() }
            // The file is editable and older versions of it may not have had the
            // same rules, so the duplicates are dropped on the way in.
            val ids = FavoritesPolicy.sanitize(songs.map { it.videoId })
            val byId = songs.associateBy { it.videoId }
            ids.mapNotNull { byId[it] }
        }.getOrDefault(emptyList())
    }

    @Synchronized
    private fun update(transform: (List<Song>) -> List<Song>) {
        val next = transform(state.value)
        val array = JSONArray()
        next.forEach { array.put(it.toJson()) }
        val output = file.startWrite()
        try {
            output.write(array.toString().toByteArray(Charsets.UTF_8))
            file.finishWrite(output)
        } catch (error: Throwable) {
            file.failWrite(output)
            throw error
        }
        state.value = next
    }

    fun isFavorite(videoId: String): Boolean = state.value.any { it.videoId == videoId }

    fun ids(): List<String> = state.value.map { it.videoId }

    /**
     * Adds [song] to the front, or removes it. Returns whether it is a favourite
     * afterwards, which is what the heart needs to paint itself.
     */
    @Synchronized
    fun toggle(song: Song): Boolean {
        val present = isFavorite(song.videoId)
        if (present) {
            update { list -> list.filterNot { it.videoId == song.videoId } }
        } else {
            update { list -> (listOf(song) + list.filterNot { it.videoId == song.videoId }).take(FavoritesPolicy.LIMIT) }
        }
        return !present
    }

    /**
     * Sets membership outright.
     *
     * Used when the heart already knows the direction — an un-like that came
     * from YouTube rather than from this list should clear it here too, without
     * toggling it back on if it happened to be absent already.
     */
    @Synchronized
    fun setFavorite(song: Song, favorite: Boolean) {
        val present = isFavorite(song.videoId)
        if (present == favorite) return
        if (favorite) {
            update { list -> (listOf(song) + list.filterNot { it.videoId == song.videoId }).take(FavoritesPolicy.LIMIT) }
        } else {
            update { list -> list.filterNot { it.videoId == song.videoId } }
        }
    }

    /** Replaces the stored snapshot of an already-favourite song. */
    @Synchronized
    fun refresh(song: Song) {
        if (!isFavorite(song.videoId)) return
        update { list -> list.map { if (it.videoId == song.videoId) song.copy(videoId = it.videoId) else it } }
    }

    fun clear() = update { emptyList() }
}

private fun Song.toJson(): JSONObject = JSONObject()
    .put("id", videoId)
    .put("title", title)
    .put("artist", artist)
    .put("art", thumbnailUrl)
    .put("duration", durationText)
    .put("album", albumName)
    .put("uri", localUri)
    .put("path", localPath)
    .put("format", downloadFormat)
    .put("track", localTrackNumber)
    .put("disc", localDiscNumber)

/** Mirrors [DevicePlaylistStore]'s decoder, so a song reads the same either side. */
private fun JSONObject.toSong(): Song {
    fun optional(key: String) = if (isNull(key)) null else optString(key).takeIf { it.isNotBlank() }
    return Song(
        videoId = getString("id"),
        title = getString("title"),
        artist = getString("artist"),
        thumbnailUrl = optional("art"),
        durationText = optional("duration"),
        albumName = optional("album"),
        localUri = optional("uri"),
        localPath = optional("path"),
        downloadFormat = optional("format"),
        localTrackNumber = optInt("track").takeIf { it > 0 },
        localDiscNumber = optInt("disc").takeIf { it > 0 },
    )
}
