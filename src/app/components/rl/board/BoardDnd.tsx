import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useDroppable,
  useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { PlanningV2Edit } from "../../../lib/planningV2Editing";
import type { PlanningDayV2, PlanningItemV2 } from "../../../lib/planningTypes";

/** What is being dragged: a place on a day, or one waiting in Places to visit. */
type Dragged = { itemId: string; label: string; city: string; waiting?: boolean; day?: number };
/** Where it can land: a position in a day. */
type Target = { day: number; index: number };
export type DragProps = { ref: (element: HTMLElement | null) => void; style: CSSProperties; dragging: boolean; handle: ReactNode };

const ActiveDrag = createContext<Dragged | undefined>(undefined);

/** Cards are the drop targets; a day's own drop zone exists only while it has no places (see SortableDayList). */
const collision: CollisionDetection = closestCenter;
const townOf = (day: PlanningDayV2) => (day.visitCity ?? day.city).toLowerCase();

/** Wraps the board so place cards can be dragged within a day, between days in a town, and from Places to visit. */
export function BoardDndProvider({ onEdit, children }: { onEdit: (edit: PlanningV2Edit) => void; children: ReactNode }) {
  const [active, setActive] = useState<Dragged>();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const start = (event: DragStartEvent) => setActive(event.active.data.current as Dragged);
  const end = (event: DragEndEvent) => {
    setActive(undefined);
    const dragged = event.active.data.current as Dragged | undefined;
    const target = event.over?.data.current as (Target & Partial<Dragged>) | undefined;
    if (!dragged || !target || event.over?.id === event.active.id) return;
    // Within a day the card takes the target's place; into another day it goes before or after the target card.
    let index = target.index;
    const moving = event.active.rect.current.translated;
    const onto = event.over?.rect;
    if ((dragged.waiting || dragged.day !== target.day) && target.itemId && moving && onto &&
      moving.top + moving.height / 2 > onto.top + onto.height / 2) index += 1;
    onEdit(dragged.waiting ? { type: "restore", itemId: dragged.itemId, day: target.day, index }
      : { type: "place", itemId: dragged.itemId, day: target.day, index });
  };
  return <ActiveDrag.Provider value={active}>
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={start} onDragEnd={end} onDragCancel={() => setActive(undefined)}
      accessibility={{ screenReaderInstructions: { draggable: "To pick up a place, press space or enter. Use the arrow keys to move it, space or enter to drop it, or escape to cancel." } }}>
      {children}
      <DragOverlay dropAnimation={null}>{active && <div className="wr-drag-overlay"><GripVertical size={16} aria-hidden="true" /> {active.label}</div>}</DragOverlay>
    </DndContext>
  </ActiveDrag.Provider>;
}

/** One day's places as a sortable list that also accepts drops at its end (or when empty). */
export function SortableDayList({ day, items, renderCard }: { day: PlanningDayV2; items: PlanningItemV2[];
  renderCard: (item: PlanningItemV2, index: number, drag: DragProps) => ReactNode }) {
  const active = useContext(ActiveDrag);
  // Off while the day has places, so keyboard moves and drops always land between cards.
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day.day}`, data: { day: day.day, index: items.length } satisfies Target,
    disabled: items.length > 0 });
  const compatible = !!active && active.city.toLowerCase() === townOf(day);
  const state = active ? compatible ? " is-drop-target" : " is-drop-blocked" : "";
  return <SortableContext id={`day-list-${day.day}`} items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
    <ol ref={setNodeRef} className={`wr-board-cards${state}${isOver && compatible ? " is-over" : ""}`}>
      {items.map((item, index) => <SortableCard key={item.id} item={item} index={index} day={day} renderCard={renderCard} />)}
      {compatible && items.length === 0 && <li className="wr-board-cards__drop" aria-hidden="true">Drop here</li>}
    </ol>
  </SortableContext>;
}

function SortableCard({ item, index, day, renderCard }: { item: PlanningItemV2; index: number; day: PlanningDayV2;
  renderCard: (item: PlanningItemV2, index: number, drag: DragProps) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id,
    data: { day: day.day, index, itemId: item.id, label: item.label, city: day.visitCity ?? day.city } satisfies Target & Dragged });
  return <>{renderCard(item, index, {
    ref: setNodeRef, dragging: isDragging,
    style: { transform: CSS.Translate.toString(transform), transition },
    handle: <button type="button" className="wr-drag-handle" aria-label={`Drag ${item.label}`} {...attributes} {...listeners}>
      <GripVertical size={18} aria-hidden="true" /></button>,
  })}</>;
}

/** A place in Places to visit that can be dragged onto a day in its town. */
export function DraggableWaiting({ id, label, city, children }: { id: string; label: string; city: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `waiting:${id}`,
    data: { itemId: id, label, city, waiting: true } satisfies Dragged });
  return <div ref={setNodeRef} className={`wr-waiting__drag${isDragging ? " is-dragging" : ""}`}>
    <button type="button" className="wr-drag-handle" aria-label={`Drag ${label} onto a day`} {...attributes} {...listeners}>
      <GripVertical size={18} aria-hidden="true" /></button>
    {children}
  </div>;
}
