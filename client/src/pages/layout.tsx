import { Helmet } from 'react-helmet';
import { LoadingIndicator } from '../common/loading';

export function MainLayout({
  children,
  title,
}: {
  title?: string;
  children?: React.ReactNode;
}): React.ReactNode {
  const margin = 15;
  return (
    <>
      {title !== undefined && (
        // @ts-expect-error react-helmet seems deprecated
        <Helmet>
          <title>{`${title} | Call Schedule`}</title>
        </Helmet>
      )}
      <div
        style={{
          margin: `${margin}px`,
          height: `calc(100vh - ${2 * margin}px)`,
        }}
      >
        {children}
      </div>
    </>
  );
}
export function LoadingPage(): React.ReactNode {
  return (
    <MainLayout>
      <LoadingIndicator />
    </MainLayout>
  );
}
