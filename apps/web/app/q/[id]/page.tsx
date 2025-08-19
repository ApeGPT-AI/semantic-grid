import type { Metadata } from "next";
import { Suspense } from "react";

import { QueryDataProvider } from "@/app/contexts/QueryData";
import { getQuery } from "@/app/lib/gptAPI";
import { QueryContainer } from "@/app/q/[id]/query-container";

import AppBar from "../app-bar";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const getQueryById = async (id: string) => getQuery({ queryId: id });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  // fetch post information
  const query = (await getQueryById(id)) as any;

  return {
    title: `ApexGPT Query: ${query.summary}`,
    description: query.description,
    openGraph: {
      title: `ApexGPT Query: ${query.summary}`,
      description: query.description,
      url: `/q/${id}`,
      images: [
        {
          url: "/apegpt-logo-mark.svg",
          alt: `ApgGPT logo`,
        },
      ],
    },
  };
}

const QueryPage = async ({ params: { id } }: { params: { id: string } }) => {
  const query = await getQueryById(id);
  console.log("query", query);

  return (
    <Suspense fallback={<div>Loading messages...</div>}>
      <QueryDataProvider query={query} queryId={id}>
        <AppBar id={id} />
        <QueryContainer key={id} id={id} query={query} />
      </QueryDataProvider>
    </Suspense>
  );
};

export default QueryPage;
