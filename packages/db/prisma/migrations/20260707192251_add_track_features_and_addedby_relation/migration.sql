-- AlterTable
ALTER TABLE "playlist_tracks" ADD COLUMN     "danceability" DOUBLE PRECISION,
ADD COLUMN     "energy" DOUBLE PRECISION,
ADD COLUMN     "tempo" DOUBLE PRECISION,
ADD COLUMN     "valence" DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
