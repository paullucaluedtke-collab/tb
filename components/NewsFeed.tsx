import React from 'react';

export interface NewsItem {
    uuid: string;
    title: string;
    publisher: string;
    link: string;
    providerPublishTime: any;
}

interface NewsFeedProps {
    news: NewsItem[];
    sentimentDetails?: Record<string, 'Positive' | 'Negative' | 'Neutral'>;
}

const formatDate = (dateInput: any) => {
    if (!dateInput) return 'Unknown Date';
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return 'Invalid Date';
        // Show relative time for recent articles
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
        return 'Invalid Date';
    }
};

const NewsFeed = ({ news, sentimentDetails }: NewsFeedProps) => {
    if (!news || news.length === 0) {
        return <div className="text-gray-500">No news available.</div>;
    }

    return (
        <div className="space-y-3">
            {news.map((item) => {
                const sentiment = sentimentDetails ? sentimentDetails[item.title] : undefined;
                const isRelevant = !!sentiment;

                let badgeColor = 'bg-gray-100 text-gray-600';
                let borderColor = 'border-gray-200';
                let accentClass = '';

                if (sentiment === 'Positive') {
                    badgeColor = 'bg-green-100 text-green-700';
                    borderColor = 'border-green-400';
                    accentClass = 'border-l-4 border-l-green-400 bg-green-50/30';
                } else if (sentiment === 'Negative') {
                    badgeColor = 'bg-red-100 text-red-700';
                    borderColor = 'border-red-400';
                    accentClass = 'border-l-4 border-l-red-400 bg-red-50/30';
                } else if (sentiment === 'Neutral') {
                    badgeColor = 'bg-gray-100 text-gray-600';
                    accentClass = 'border-l-4 border-l-gray-300';
                }

                return (
                    <a
                        key={item.uuid}
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block p-3 rounded-xl transition-all hover:shadow-sm ${isRelevant ? accentClass : 'hover:bg-gray-50'}`}
                    >
                        <h4 className="font-semibold text-sm text-gray-800 hover:text-indigo-600 flex items-start gap-2 flex-wrap leading-snug">
                            {item.title}
                            {isRelevant && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold whitespace-nowrap ${badgeColor}`}>
                                    {sentiment}
                                </span>
                            )}
                        </h4>
                        <div className="text-xs text-gray-400 mt-1 flex justify-between">
                            <span className="font-medium">{item.publisher}</span>
                            <span>{formatDate(item.providerPublishTime)}</span>
                        </div>
                    </a>
                );
            })}
        </div>
    );
};

export default NewsFeed;
