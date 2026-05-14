import Link from "next/link";
import { UserX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function PatientNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <UserX className="h-10 w-10 text-muted-foreground" />
      <h1 className="mt-4 text-xl font-semibold">Patient not found</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        No patient exists with that ID.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/patients">Back to patients</Link>
      </Button>
    </div>
  );
}
