"use client";

import { Loader, Select } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useEffect, useState } from "react";

import {
  searchOrganizations,
  type OrganizationOption,
} from "@/app/actions/organizations";

interface OrganizationSelectProps {
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
}

export function OrganizationSelect({
  value,
  onChange,
  error,
}: OrganizationSelectProps) {
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search, 250);
  const [data, setData] = useState<OrganizationOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) return; // too short to search; display is gated below

    let active = true;
    // Imperative in-flight flag for the async search — there is no
    // render-derivable equivalent, so setting it here is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    searchOrganizations(q)
      .then((options) => {
        if (active) setData(options);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debounced]);

  // Show no options until the query is long enough to have been searched.
  const options = debounced.trim().length < 2 ? [] : data;

  return (
    <Select
      label="Organization"
      placeholder="Search organizations..."
      searchable
      data={options}
      value={value}
      onChange={onChange}
      searchValue={search}
      onSearchChange={setSearch}
      rightSection={loading ? <Loader size="xs" /> : undefined}
      nothingFoundMessage={
        debounced.trim().length < 2
          ? "Type at least 2 characters"
          : "No organizations found"
      }
      error={error}
      required
    />
  );
}
