import { client } from "./client";
import type { Transaction, TransactionInput } from "@/types";

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data } = await client.get<{ transactions: Transaction[] }>(
    "/transactions",
  );
  return data.transactions;
}

export async function createTransaction(
  input: TransactionInput,
): Promise<Transaction> {
  const { data } = await client.post<{ transaction: Transaction }>(
    "/transactions",
    input,
  );
  return data.transaction;
}
