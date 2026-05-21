import { useAuth } from "@clerk/react";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setUserId, getUserId } from "@/api/client";

export function ClerkUserSync() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const prevId = useRef<string>(getUserId());

  useEffect(() => {
    const newId = userId ?? "default";
    if (prevId.current !== newId) {
      setUserId(newId);
      prevId.current = newId;
      queryClient.invalidateQueries();
    }
  }, [userId, queryClient]);

  return null;
}
