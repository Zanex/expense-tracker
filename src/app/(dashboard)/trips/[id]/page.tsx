import { TripDetail } from "~/components/trips/trip-detail";

interface TripPageProps {
  params: Promise<{ id: string }>;
}

export default async function TripPage({ params }: TripPageProps) {
  const { id } = await params;
  return <TripDetail tripId={id} />;
}
