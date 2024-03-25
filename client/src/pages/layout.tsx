import { Helmet } from 'react-helmet';
import { LoadingIndicator } from '../common/loading';

export function MainLayout({
  children,
  title,
}: {
  title?: string;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <>
      {title !== undefined && (
        // @ts-expect-error react-helmet seems deprecated
        <Helmet>
          <title>{`${title} | Metro`}</title>
        </Helmet>
      )}
      <div
        style={{
          height: '95vh',
        }}
      >
        <div
          style={{
            padding: '10px',
            margin: '20px',
            height: '100%',
          }}
        >
          {children}
        </div>
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
