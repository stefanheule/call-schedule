import { Helmet } from 'react-helmet';
import { LoadingIndicator } from '../common/loading';

export function MainLayout({
  children,
  title,
}: {
  title?: string;
  children?: React.ReactNode;
}): JSX.Element {
  const margin = 15;
  return (
    <>
      {title !== undefined && (
        <Helmet>
          <title>{`${title} | Metro`}</title>
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
export function LoadingPage(): JSX.Element {
  return (
    <MainLayout>
      <LoadingIndicator />
    </MainLayout>
  );
}
