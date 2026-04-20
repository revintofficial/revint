"use client";

/**
 * Raw Google review list for a lead. Previously lived inside each Shortlist
 * card; now lives on the lead detail page where it's consulted once during
 * deep research rather than repeatedly on a long list view.
 *
 * Lazy-loaded: the list is fetched the first time the section expands, then
 * refreshable on demand.
 */

import { useCallback, useState } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  RefreshCw,
  Star,
} from "lucide-react";

interface GoogleReview {
  id: string;
  authorName: string;
  authorPhoto: string | null;
  rating: number;
  text: string | null;
  relativeTime: string;
  publishTime: string;
}

export function GoogleReviewsAccordion({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<GoogleReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchReviews = useCallback(
    async (refresh = false) => {
      setLoading(true);
      try {
        const url = `/api/reviews/${leadId}${refresh ? "?refresh=true" : ""}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setReviews(data.reviews || []);
          setLoaded(true);
        }
      } catch (err) {
        console.error("Failed to fetch reviews:", err);
      } finally {
        setLoading(false);
      }
    },
    [leadId]
  );

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) fetchReviews(false);
  };

  const avg =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleToggle}
            className="flex items-center gap-2 min-w-0 flex-1 text-left"
          >
            {open ? (
              <ChevronUp className="w-5 h-5 text-white/30 shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/30 shrink-0" />
            )}
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <MessageSquare className="w-5 h-5 text-[#0A84FF] shrink-0" />
              Google Reviews
            </CardTitle>
            {loaded && reviews.length > 0 && (
              <span className="text-xs text-white/30">
                ({reviews.length} review{reviews.length === 1 ? "" : "s"}
                {avg && ` · ${avg}`})
              </span>
            )}
          </button>
          {open && loaded && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs"
              onClick={() => fetchReviews(true)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-3">
          {loading && reviews.length === 0 && (
            <div className="flex flex-col items-center py-6 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-white/50" />
              <p className="text-xs text-white/30">Loading reviews...</p>
            </div>
          )}

          {!loading && loaded && reviews.length === 0 && (
            <p className="text-sm text-white/30 text-center py-3">
              No Google reviews found for this business.
            </p>
          )}

          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {review.authorPhoto ? (
                    <Image
                      src={review.authorPhoto}
                      alt={review.authorName}
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded-full"
                      unoptimized
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-medium text-white/50">
                      {review.authorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium text-white/70">
                    {review.authorName}
                  </span>
                </div>
                <span className="text-xs text-white/30">{review.relativeTime}</span>
              </div>
              <StarRating rating={review.rating} />
              {review.text && (
                <p className="text-sm text-white/60 leading-relaxed">{review.text}</p>
              )}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3.5 h-3.5 ${
            star <= rating ? "text-[#FF9F0A] fill-[#FF9500]" : "text-white/20"
          }`}
        />
      ))}
    </span>
  );
}
