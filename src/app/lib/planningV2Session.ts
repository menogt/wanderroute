import type { PlanningRouteConcept, PlanningV2Result } from "./planningV2";
import type { TripBriefV1 } from "./planningTypes";
import type { DetailedPlanningResult } from "./planningV2Itinerary";

export type PlanningV2Session = {
  view: "brief" | "compare" | "selected" | "itinerary";
  brief?: TripBriefV1;
  result?: PlanningV2Result;
  selectedConceptId?: string;
  detailed?: DetailedPlanningResult;
  editPast?: DetailedPlanningResult[];
  editFuture?: DetailedPlanningResult[];
  editError?: string;
  preferredRevision?: string;
};

export const emptyPlanningV2Session = (): PlanningV2Session => ({ view: "brief" });

export function showPlanningConcepts(result: PlanningV2Result): PlanningV2Session {
  return { view: "compare", brief: result.brief, result };
}

export function selectPlanningConcept(session: PlanningV2Session, conceptId: string): PlanningV2Session {
  const concept = session.result?.concepts.find(item => item.routeConcept.id === conceptId);
  if (!concept || concept.readiness === "INVALID") return session;
  return { ...session, view: "selected", selectedConceptId: conceptId,
    ...(session.selectedConceptId === conceptId ? {} : { detailed: undefined,
      editPast: [], editFuture: [], editError: undefined }) };
}

export function showPlanningItinerary(session: PlanningV2Session, selectedId: string,
  detailed: DetailedPlanningResult): PlanningV2Session {
  if (session.selectedConceptId !== selectedId || detailed.itinerary.routeConceptId !== selectedId) return session;
  return { ...session, view: "itinerary", detailed, editPast: [], editFuture: [], editError: undefined };
}

export function returnToPlanningConcepts(session: PlanningV2Session): PlanningV2Session {
  return session.result ? { ...session, view: "compare" } : { ...session, view: "brief" };
}

export function selectedPlanningConcept(session: PlanningV2Session): PlanningRouteConcept | undefined {
  return session.result?.concepts.find(item => item.routeConcept.id === session.selectedConceptId);
}
