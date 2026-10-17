import GoalCard from './GoalCard';
import HorizontalRail from './HorizontalRail';

/**
 * Carril horizontal de objetivos: 1 por vista en mobile, 2 en tablet y 3 en desktop.
 * @param {{ items: import('../model/goalLists').GoalItem[], label: string }} props
 */
export default function GoalsCarousel({ items, label }) {
  return (
    <HorizontalRail
      label={label}
      itemLabel="objetivos"
      itemClassName="basis-[85%] sm:basis-[calc((100%-0.75rem)/2)] xl:basis-[calc((100%-1.5rem)/3)]"
      items={items.map(item => ({ key: item.goal.id, node: <GoalCard item={item} /> }))}
    />
  );
}
