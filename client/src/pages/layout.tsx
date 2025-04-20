import { Helmet } from 'react-helmet';
import { LoadingIndicator } from '../common/loading';

export function MainLayout({
  children,
  title,
  noMargin,
}: {
  title?: string;
  children?: React.ReactNode;
  noMargin?: boolean;
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
          margin: noMargin ? '0px' : `${margin}px`,
          height: noMargin ? '100vh' : `calc(100vh - ${2 * margin}px)`,
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
