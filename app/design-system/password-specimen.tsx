"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordToggle } from "@/components/password-toggle";

/** Specimen only: a password field with the shared Show/Hide toggle. */
export function PasswordSpecimen() {
  const [shown, setShown] = useState(false);
  return (
    <div className="max-w-sm space-y-1.5">
      <Label htmlFor="specimen-password">Password</Label>
      <div className="relative">
        <Input
          id="specimen-password"
          type={shown ? "text" : "password"}
          defaultValue="Example-only"
          autoComplete="off"
          className="pr-16"
        />
        <PasswordToggle
          shown={shown}
          field="password"
          controls="specimen-password"
          onToggle={() => setShown(!shown)}
        />
      </div>
    </div>
  );
}
