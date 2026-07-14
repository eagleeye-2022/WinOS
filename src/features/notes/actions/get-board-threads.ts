"use server";

import { getThreads } from "../queries";

export async function getBoardThreads(boardId: string) {
  return await getThreads(boardId);
}
