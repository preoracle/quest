import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { enrollTopic, fetchDue, fetchTopics, startSession, unenrollTopic } from "@/api/client";
import type { StartMode, TopicCatalogItem } from "@/api/types";
import { AppShell } from "@/components/AppShell";
import { CreateTopicPanel } from "@/components/CreateTopicPanel";
import { FilterChips } from "@/components/FilterChips";
import { PageScaffold } from "@/components/PageScaffold";
import { TopicListSkeleton } from "@/components/Skeleton";
import { TopicRow } from "@/components/TopicRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPanelSlot, listGap, sectionGap, sectionLabel } from "@/lib/layout";
import { cn } from "@/lib/utils";
import {
  filterTopics,
  groupTopics,
  rankTopics,
  recordTopicUse,
  type TopicFilter,
} from "@/lib/topicActivity";

const LIBRARY_CAP = 12;
const SEARCH_DEBOUNCE_MS = 300;

const VALID_FILTERS: TopicFilter[] = ["all", "due", "in_progress", "new"];

const FILTERS: { id: TopicFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "due", label: "Due" },
  { id: "in_progress", label: "In progress" },
  { id: "new", label: "New" },
];

export function TopicsPage() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [starting, setStarting] = useState<string | null>(null);
  const [showAllLibrary, setShowAllLibrary] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [enrollBusy, setEnrollBusy] = useState<string | null>(null);

  // URL-encoded persistent state
  const urlQuery = searchParams.get("q") ?? "";
  const rawFilter = searchParams.get("filter") ?? "all";
  const filter: TopicFilter = (VALID_FILTERS.includes(rawFilter as TopicFilter) ? rawFilter : "all") as TopicFilter;
  const showArchived = searchParams.get("archived") === "1";

  // Local input state (instant feedback), syncs to URL with debounce
  const [inputQuery, setInputQuery] = useState(urlQuery);
  const query = urlQuery; // API uses URL value

  function handleQueryInput(q: string) {
    setInputQuery(q);
    clearTimeout((handleQueryInput as { _t?: ReturnType<typeof setTimeout> })._t);
    (handleQueryInput as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (q) next.set("q", q); else next.delete("q");
        return next;
      }, { replace: true });
    }, SEARCH_DEBOUNCE_MS);
  }

  function setFilter(f: TopicFilter) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (f === "all") next.delete("filter"); else next.set("filter", f);
      return next;
    }, { replace: true });
  }

  function setShowArchived(v: boolean) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (v) next.set("archived", "1"); else next.delete("archived");
      return next;
    }, { replace: true });
  }

  const { data: topicsData, isLoading: topicsLoading, refetch: refetchTopics } = useQuery({
    queryKey: ["topics", query, showArchived],
    queryFn: () => fetchTopics({ q: query, includeArchived: showArchived }),
    staleTime: 20_000,
  });

  const { data: dueData } = useQuery({
    queryKey: ["due"],
    queryFn: () => fetchDue(),
    staleTime: 60_000,
  });

  const topics = useMemo(() => rankTopics(topicsData ?? []), [topicsData]);
  const due = dueData?.items.length ?? 0;
  const loading = topicsLoading;

  function reloadCatalog() {
    refetchTopics();
  }

  const filtered = useMemo(
    () => filterTopics(topics, filter, query),
    [topics, filter, query],
  );

  const sections = useMemo(() => {
    if (filter !== "all" || query.trim()) {
      return { pickUp: filtered, explore: [] as typeof filtered, library: [] as typeof filtered };
    }
    return groupTopics(filtered);
  }, [filtered, filter, query]);

  const libraryVisible = useMemo(() => {
    const lib = sections.library;
    if (showAllLibrary || lib.length <= LIBRARY_CAP) return lib;
    return lib.slice(0, LIBRARY_CAP);
  }, [sections.library, showAllLibrary]);

  const totalVisible =
    sections.pickUp.length + sections.explore.length + libraryVisible.length;

  const filterOptions = FILTERS.map((f) =>
    f.id === "due" ? { ...f, count: due } : f,
  );

  async function begin(topicId: string, mode: StartMode) {
    setStarting(topicId);
    recordTopicUse(topicId);
    try {
      let session = await startSession(topicId, mode);
      if (session.done && mode !== "replay") {
        session = await startSession(topicId, "resume");
      }
      if (session.done) {
        session = await startSession(topicId, "replay");
      }
      navigate(`/session/${session.session_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start session");
    } finally {
      setStarting(null);
    }
  }

  async function toggleEnroll(topic: TopicCatalogItem) {
    setEnrollBusy(topic.id);
    try {
      if (topic.enrolled) {
        await unenrollTopic(topic.id);
        toast.success(`Removed "${topic.display_name}" from your topics`);
      } else {
        await enrollTopic(topic.id);
        toast.success(`Added "${topic.display_name}" to your topics`);
      }
      queryClient.invalidateQueries({ queryKey: ["topics"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update enrollment");
    } finally {
      setEnrollBusy(null);
    }
  }

  const toolbar = (
    <div className={cn("flex flex-col", sectionGap)}>
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-on-muted" />
          <Input
            type="search"
            value={inputQuery}
            onChange={(e) => handleQueryInput(e.target.value)}
            placeholder="Search topics"
            className="h-11 rounded-xl border-line/50 bg-surface/30 pl-10"
            aria-label="Search topics"
          />
        </div>
        <Button
          type="button"
          variant={showCreate ? "secondary" : "outline"}
          className="h-11 shrink-0 gap-2 px-4"
          onClick={() => setShowCreate((v) => !v)}
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">New topic</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      <div className={cn(showCreate ? createPanelSlot : undefined, "transition-all")}>
        <CreateTopicPanel
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={reloadCatalog}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 overflow-x-auto">
          <FilterChips
            options={filterOptions}
            value={filter}
            onChange={setFilter}
          />
        </div>
        <div className="flex shrink-0 items-center gap-4 text-sm text-on-muted">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="size-3.5 rounded border-line accent-accent"
            />
            Archived
          </label>
          {!loading && (
            <span className="font-mono text-xs tabular-nums text-on-muted/70">
              {totalVisible} topics
            </span>
          )}
        </div>
      </div>

    </div>
  );

  return (
    <AppShell>
      <PageScaffold toolbar={toolbar} tier="catalog">
        {loading ? (
          <TopicListSkeleton />
        ) : filtered.length === 0 ? (
          <p className="py-page text-center text-sm text-on-muted">
            No topics match your search or filter.
          </p>
        ) : (
          <div className={cn("flex flex-col", sectionGap)}>
            {sections.pickUp.length > 0 && (
              <Section topics={sections.pickUp} label="Pick up" reduce={reduce} starting={starting} enrollBusy={enrollBusy} onContinue={begin} onToggleEnroll={toggleEnroll} />
            )}
            {sections.explore.length > 0 && (
              <Section topics={sections.explore} label="Explore" reduce={reduce} starting={starting} enrollBusy={enrollBusy} onContinue={begin} onToggleEnroll={toggleEnroll} />
            )}
            {libraryVisible.length > 0 && (
              <>
                <Section topics={libraryVisible} label="Library" reduce={reduce} starting={starting} enrollBusy={enrollBusy} onContinue={begin} onToggleEnroll={toggleEnroll} />
                {sections.library.length > LIBRARY_CAP && !showAllLibrary && (
                  <button
                    type="button"
                    onClick={() => setShowAllLibrary(true)}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    Show all {sections.library.length}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </PageScaffold>
    </AppShell>
  );
}

function Section({
  label,
  topics,
  reduce,
  starting,
  enrollBusy,
  onContinue,
  onToggleEnroll,
}: {
  label: string;
  topics: ReturnType<typeof rankTopics>;
  reduce: boolean | null;
  starting: string | null;
  enrollBusy: string | null;
  onContinue: (id: string, mode: StartMode) => void;
  onToggleEnroll: (topic: TopicCatalogItem) => void;
}) {
  return (
    <section>
      <h2 className={cn(sectionLabel, "mb-1.5")}>
        {label}
        <span className="font-normal text-on-muted/50">{topics.length}</span>
      </h2>
      <div className={cn("flex flex-col", listGap)}>
        {topics.map((t, i) => (
          <motion.div
            key={t.id}
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.12) }}
          >
            <TopicRow
              topic={t}
              busy={starting === t.id}
              onContinue={() => onContinue(t.id, "resume")}
              onToggleEnroll={() => onToggleEnroll(t)}
              enrollBusy={enrollBusy === t.id}
            />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
