type NextPageProps = {
  params: Promise<{ [key: string]: string | string[] | undefined }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

type NextLayoutProps = {
  params: Promise<{ [key: string]: string | string[] | undefined }>;
  children?: React.ReactNode;
};
