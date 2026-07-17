'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

interface ScheduleInput {
  text: string;
  channelIds: string[];
  publishAt: string; // ISO UTC
  timezone: string;
  textByChannel?: Record<string, string>;
  settingsByChannel?: Record<string, Record<string, unknown>>;
  mediaIds?: string[];
  thread?: Array<{ text: string; mediaIds?: string[]; delaySec?: number }>;
  requireApproval?: boolean;
}

export function useSchedulePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduleInput) => {
      const { data, error } = await api.POST('/v1/posts', {
        body: {
          text: input.text,
          channelIds: input.channelIds,
          publishAt: input.publishAt,
          timezone: input.timezone,
          ...(input.textByChannel && Object.keys(input.textByChannel).length > 0
            ? { textByChannel: input.textByChannel }
            : {}),
          ...(input.settingsByChannel && Object.keys(input.settingsByChannel).length > 0
            ? { settingsByChannel: input.settingsByChannel }
            : {}),
          ...(input.mediaIds && input.mediaIds.length > 0 ? { mediaIds: input.mediaIds } : {}),
          ...(input.thread && input.thread.length > 0 ? { thread: input.thread } : {}),
          ...(input.requireApproval ? { requireApproval: true } : {}),
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['publications'] }),
  });
}
