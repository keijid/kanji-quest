import { STAGE_COUNT } from '@/lib/data';
import { StageScreen } from './StageScreen';

export const dynamicParams = false;
export function generateStaticParams() {
  return Array.from({ length: STAGE_COUNT }, (_, i) => ({ id: String(i + 1) }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StageScreen stage={Number(id)} />;
}
