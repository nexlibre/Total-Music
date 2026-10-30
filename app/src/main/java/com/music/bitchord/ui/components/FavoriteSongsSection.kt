package com.music.bitchord.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.music.bitchord.R
import com.music.bitchord.data.model.Song
import com.music.bitchord.data.model.isSameTrackAs

/**
 * "Favorite songs": the device's own list, at the top of Biblioteca.
 *
 * The hearts already existed in every player, but a rating belongs to an
 * account, so a signed-out listener — or any local file, which YouTube has
 * never heard of — had nowhere to land. This is that landing place, and it is
 * the same list every heart in the app writes to.
 *
 * Rows are real [SongRow]s rather than cards: a favourite is a track, and the
 * queue it builds should be the tracks in the order they were favourited.
 *
 * The section is drawn even when empty, with a line saying how to fill it.
 * Hidden-until-used is how the "On device" shelf behaves, and it is right
 * there — there is a device and everyone knows songs can be on it. Nobody
 * discovers a feature by it not being drawn.
 */
@Composable
fun FavoriteSongsSection(
    songs: List<Song>,
    onSongClick: (List<Song>, Int) -> Unit,
    onSongLongPress: (Song) -> Unit,
    currentSong: Song?,
    isPlaying: Boolean,
    modifier: Modifier = Modifier,
    /** How many rows show before "Show all"; the same five the shelves use. */
    collapsedCount: Int = 5,
) {
    // Local to the section: leaving Biblioteca and coming back collapses it,
    // which is the behaviour of every other "show all" here.
    var expanded by remember { mutableStateOf(false) }
    val shown = if (expanded) songs else songs.take(collapsedCount)

    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = PAGE_GUTTER, end = 4.dp, top = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = stringResource(R.string.favorite_songs),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onBackground,
                modifier = Modifier
                    .weight(1f)
                    .padding(vertical = 8.dp),
            )
            if (songs.size > collapsedCount) {
                TextButton(onClick = { expanded = !expanded }) {
                    Text(stringResource(R.string.show_all))
                }
            }
        }

        if (songs.isEmpty()) {
            Text(
                text = stringResource(R.string.favorite_songs_empty),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = PAGE_GUTTER, end = PAGE_GUTTER, bottom = 12.dp),
            )
        } else {
            shown.forEachIndexed { index, song ->
                SongRow(
                    song = song,
                    // The whole list is the queue, and the index is into the
                    // list rather than into [shown] so a collapsed section
                    // still starts where the row says it does.
                    onClick = { onSongClick(songs, index) },
                    onLongPress = { onSongLongPress(song) },
                    isCurrent = song.isSameTrackAs(currentSong),
                    isPlaying = song.isSameTrackAs(currentSong) && isPlaying,
                )
            }
        }
    }
}
