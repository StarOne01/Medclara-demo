import { ScribePage } from "@/components/scribe-page";

type Props = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function ScribeSessionRoute({ params }: Props) {
  const { sessionId } = await params;
  
  return <ScribePage sessionIdFromUrl={sessionId} />;
}
