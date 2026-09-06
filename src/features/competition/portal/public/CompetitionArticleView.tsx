import { useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronRight, Clock3, Share2 } from 'lucide-react';
import { Link } from 'react-router';
import type { PublicCompetitionArticleDto } from '../../../../../shared/competition-portal.contract';
import { formatSystemDateTimeWithOptions } from '../../../../utils/dateTime';
import CompetitionMarkdown from './CompetitionMarkdown';
import CompetitionPublicShell from './CompetitionPublicShell';
import { ArticleTypeIcon, SectionEyebrow, articleTypePresentation } from './CompetitionPublicDesign';

interface CompetitionArticleViewProps {
  article: PublicCompetitionArticleDto;
  campaignSlug: string;
}

const formatPublishedAt = (value: string): string => formatSystemDateTimeWithOptions(value, {
  dateStyle: 'long',
});

const CompetitionArticleView = ({ article, campaignSlug }: CompetitionArticleViewProps) => {
  const presentation = articleTypePresentation[article.type];
  const campaignHref = `/cuoc-thi/${encodeURIComponent(campaignSlug)}`;
  const [coverImageFailed, setCoverImageFailed] = useState(false);
  const showCoverImage = Boolean(article.coverImageUrl && !coverImageFailed);

  return (
    <CompetitionPublicShell campaignSlug={campaignSlug}>
      <div className="border-b border-blue-100 bg-white">
        <nav aria-label="Điều hướng bài viết" className="mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto px-4 py-4 text-sm font-bold text-slate-500 sm:px-6 lg:px-8">
          <Link to="/cuoc-thi" className="inline-flex min-h-11 shrink-0 items-center rounded-lg transition hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Cuộc thi</Link>
          <ChevronRight className="size-4 shrink-0 text-slate-300" aria-hidden="true" />
          <Link to={campaignHref} className="inline-flex min-h-11 shrink-0 items-center rounded-lg transition hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">Thông tin cuộc thi</Link>
          <ChevronRight className="size-4 shrink-0 text-slate-300" aria-hidden="true" />
          <span className="truncate text-slate-700" aria-current="page">{presentation.label}</span>
        </nav>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:px-8 lg:py-14">
        <article className="overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-xl shadow-blue-950/5">
          <header className="bg-gradient-to-br from-blue-50 via-white to-cyan-50 px-6 py-8 sm:px-10 sm:py-10">
            <div className="flex items-start gap-4">
              <ArticleTypeIcon type={article.type} />
              <div>
                <SectionEyebrow>{presentation.label}</SectionEyebrow>
                <span className="sr-only">{article.type}</span>
              </div>
            </div>
            <h1 className="mt-6 max-w-4xl text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-5xl">{article.title}</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">{article.summary}</p>
            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm font-bold text-slate-500">
              <span className="inline-flex items-center gap-2"><CalendarDays className="size-4 text-blue-600" aria-hidden="true" />Công bố {formatPublishedAt(article.publishedAt)}</span>
              <span className="inline-flex items-center gap-2"><Clock3 className="size-4 text-blue-600" aria-hidden="true" />Thông tin chính thức</span>
            </div>
          </header>

          <div className="px-6 pt-6 sm:px-10">
            {showCoverImage ? (
              <img
                className="aspect-[16/9] w-full rounded-3xl object-cover"
                src={article.coverImageUrl}
                alt={article.title}
                width="1200"
                height="675"
                onError={() => setCoverImageFailed(true)}
              />
            ) : (
              <div
                role="img"
                aria-label={`Hình minh họa bài viết ${article.title}`}
                className="flex aspect-[16/9] items-center justify-center rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-100 via-white to-cyan-100"
              >
                <span className="rounded-2xl border border-white/80 bg-white/75 px-5 py-3 text-center text-sm font-extrabold text-blue-900 shadow-sm">
                  Hình minh họa bài viết
                </span>
              </div>
            )}
          </div>

          <div className="px-6 py-8 sm:px-10 sm:py-10">
            <h2 className="mb-6 text-2xl font-black text-slate-950">Nội dung bài viết</h2>
            <div className="max-w-[70ch] text-base leading-8 text-slate-700 sm:text-lg">
              <CompetitionMarkdown source={article.content} headingLevelOffset={1} />
            </div>
          </div>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start" aria-label="Thông tin hỗ trợ">
          <div className="rounded-3xl bg-blue-950 p-6 text-white shadow-lg">
            <Share2 className="size-7 text-cyan-300" aria-hidden="true" />
            <h2 className="mt-4 text-xl font-black">Thông tin dễ theo dõi</h2>
            <p className="mt-2 text-sm leading-6 text-blue-100/80">Mọi cập nhật chính thức của cuộc thi được tập hợp tại trang campaign.</p>
            <Link
              to={campaignHref}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2 font-bold text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-blue-950"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Quay lại cuộc thi
            </Link>
          </div>
        </aside>
      </div>
    </CompetitionPublicShell>
  );
};

export default CompetitionArticleView;
