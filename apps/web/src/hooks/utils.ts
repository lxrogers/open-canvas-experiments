import { Client } from "@langchain/langgraph-sdk";

export const createClient = () => {
  const apiUrl = "/api";
  return new Client({
    apiUrl,
  });
};
