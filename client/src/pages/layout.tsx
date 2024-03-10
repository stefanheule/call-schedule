import { Helmet } from 'react-helmet';
import { Heading } from '../common/text';
import { Link, useLocation } from 'react-router-dom';
import { LoadingIndicator } from '../common/loading';
import { ElementSpacer } from '../common/flex';

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
          padding: '10px',
          margin: '20px',
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
