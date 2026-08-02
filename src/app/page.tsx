import AppHeader from "@/components/AppHeader";
import CategoryGrid from "@/components/CategoryGrid";
import SearchBar from "@/components/SearchBar";

/**
 * HOME.
 *
 * The only interactive element is the search bar. Category tiles render but are
 * inert — browse navigation is deferred, and search is the entry path the whole
 * feature is premised on.
 */
export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <AppHeader />
      <div className="sticky top-0 z-10 bg-[var(--color-surface)]">
        <SearchBar />
      </div>
      <CategoryGrid />
    </main>
  );
}
