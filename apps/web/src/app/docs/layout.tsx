import { DocSidebar } from '@/components/site/docs/DocSidebar';
import { OnThisPage } from '@/components/site/docs/OnThisPage';
import { ReadingProgress } from '@/components/site/docs/ReadingProgress';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteNav } from '@/components/site/SiteNav';

const DocsLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-dvh bg-ground">
      <div className="relative">
        <SiteNav variant="docked" />
        <ReadingProgress />
      </div>

      <div className="mx-auto grid max-w-[1400px] gap-10 px-6 py-12 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_200px]">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <DocSidebar />
          </div>
        </aside>

        <article id="doc-article" className="min-w-0 pb-10">
          {children}
        </article>

        <aside className="hidden xl:block">
          <OnThisPage />
        </aside>
      </div>

      <SiteFooter />
    </div>
  );
};

export default DocsLayout;
