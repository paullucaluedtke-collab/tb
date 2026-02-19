import React from 'react';

export interface NewsItem {
    uuid: string;
    title: string;
    publisher: string;
    link: string;
    providerPublishTime: any; // Can be number, string, or Date object
}

interface NewsFeedProps {
    news: NewsItem[];
    sentimentDetails?: Record<string, 'Positive' | 'Negative' | 'Neutral'>;
}

// Helper to safely parse any date format
const formatDate = (dateInput: any) => {
    if (!dateInput) return 'Unknown Date';
    try {
        const date = new Date(dateInput);
        // Check if date is valid
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return 'Invalid Date';
    }
};

const NewsFeed = ({ news, sentimentDetails }: NewsFeedProps) => {
    if (!news || news.length === 0) {
        return <div className="text-gray-500">No news available.</div>;
    }

    return (
        <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-xl font-bold mb-4">Latest News</h3>
            <div className="space-y-4">
                {news.map((item) => {
                    const sentiment = sentimentDetails ? sentimentDetails[item.title] : undefined;
                    const isRelevant = !!sentiment;

                    let badgeColor = 'bg-gray-100 text-gray-800';
                    let borderColor = 'border-gray-200';
                    let titleColor = 'text-gray-800';

                    if (sentiment === 'Positive') {
                        badgeColor = 'bg-green-100 text-green-800';
                        borderColor = 'border-green-500';
                        titleColor = 'text-green-900';
                    } else if (sentiment === 'Negative') {
                        badgeColor = 'bg-red-100 text-red-800';
                        borderColor = 'border-red-500';
                        titleColor = 'text-red-900';
                    } else if (sentiment === 'Neutral') {
                        badgeColor = 'bg-gray-200 text-gray-800';
                        borderColor = 'border-gray-400';
                        titleColor = 'text-gray-900';
                    }

                    return (
                        <div
                            key={item.uuid}
                            className={`border-b pb-4 last:border-0 transition p-2 rounded-lg border
                                      ${isRelevant ? 'bg-opacity-50 ' + borderColor.replace('border', 'bg').replace('500', '50') + ' border-l-4 ' + borderColor : 'hover:bg-gray-50 border-transparent'}`}
                        >
                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="block group">
                                <h4 className={`font-semibold mb-1 group-hover:text-blue-600 flex items-start gap-2 flex-wrap
                                                ${isRelevant ? titleColor : 'text-gray-800'}`}>
                                    {item.title}
                                    {isRelevant && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold whitespace-nowrap ${badgeColor}`}>
                                            {sentiment}
                                        </span>
                                    )}
                                </h4>
                                <div className="text-sm text-gray-500 flex justify-between">
                                    <span>{item.publisher}</span>
                                    <span>{formatDate(item.providerPublishTime)}</span>
                                </div>
                            </a>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default NewsFeed;
