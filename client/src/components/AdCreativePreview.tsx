/**
 * AdCreativePreview — shows the actual Meta ad creative (video / image /
 * copy) associated with a given Meta adId.
 *
 * Two modes:
 * - compact: 48×48 thumbnail suitable for tables and lead cards. Click opens modal.
 * - full: rendered inside a Dialog — playable video or image, title, body,
 *   CTA, destination link, "Ver en Meta" shortcut.
 *
 * Fallback chain when fields are missing:
 *   videoSourceUrl → iframe(videoPermalinkUrl) → thumbnailUrl → placeholder.
 *
 * Designed to consume `metaAds.creativeByAdId` — the query is only fired when
 * the modal opens so grids with hundreds of rows stay cheap.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Film, Image as ImageIcon, Play, Sparkles } from "lucide-react";

export type AdCreativePreviewProps = {
  adId: string | null | undefined;
  /** Pre-fetched creative (from a batch query) — skips the per-row trpc call. */
  preloaded?: {
    videoSourceUrl: string | null;
    videoPermalinkUrl: string | null;
    thumbnailUrl: string | null;
    imageUrl: string | null;
    title: string | null;
    body: string | null;
    callToActionType: string | null;
    destinationUrl: string | null;
    instagramPermalinkUrl: string | null;
  } | null;
  /** Optional fallback name to show when the creative has no cached title. */
  adName?: string | null;
  /** compact = 48×48 thumb + tiny label; full = modal body. */
  variant?: "compact" | "inline";
  className?: string;
};

type Creative = NonNullable<AdCreativePreviewProps["preloaded"]>;

/** Reusable placeholder when there's nothing to show yet. */
function CreativePlaceholder({ size = 48 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-md border border-dashed border-muted bg-muted/30 text-muted-foreground"
      style={{ width: size, height: size }}
      aria-label="Creativo no disponible"
    >
      <Film className="h-4 w-4" />
    </div>
  );
}

/** Thumbnail button that opens the full modal on click. */
function CompactThumb({
  creative,
  onOpen,
  adName,
}: {
  creative: Creative | null;
  onOpen: () => void;
  adName?: string | null;
}) {
  const thumb = creative?.thumbnailUrl ?? creative?.imageUrl ?? null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative inline-flex h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
      aria-label={`Ver creativo del anuncio ${adName ?? ""}`.trim()}
    >
      {thumb ? (
        <img
          src={thumb}
          alt={creative?.title ?? "Ad thumbnail"}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={(e) => {
            // If Meta's CDN fails, degrade to placeholder without breaking layout.
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <CreativePlaceholder size={48} />
      )}
      {creative?.videoSourceUrl || creative?.videoPermalinkUrl ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-5 w-5 fill-white text-white" />
        </span>
      ) : null}
    </button>
  );
}

/**
 * Decides which media element to render inside the modal based on what Graph
 * returned. Order of preference: direct video source → FB/IG permalink embed →
 * static image → placeholder.
 */
function CreativeMedia({ creative }: { creative: Creative }) {
  const [videoErrored, setVideoErrored] = useState(false);

  if (creative.videoSourceUrl && !videoErrored) {
    return (
      <video
        controls
        playsInline
        poster={creative.thumbnailUrl ?? undefined}
        className="h-full w-full rounded-md bg-black object-contain"
        onError={() => setVideoErrored(true)}
      >
        <source src={creative.videoSourceUrl} />
      </video>
    );
  }

  // `permalink_url` from /video returns the FB watch URL; appending `/embed`
  // isn't universally supported, so we try an iframe src directly and rely on
  // FB's own embed handling. If the user's browser blocks third-party cookies
  // this may show a login prompt — acceptable degradation.
  if (creative.videoPermalinkUrl) {
    return (
      <iframe
        src={creative.videoPermalinkUrl}
        title={creative.title ?? "Ad video"}
        className="aspect-video w-full rounded-md"
        allow="autoplay; encrypted-media; fullscreen"
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }

  if (creative.imageUrl || creative.thumbnailUrl) {
    return (
      <img
        src={(creative.imageUrl ?? creative.thumbnailUrl) as string}
        alt={creative.title ?? "Ad image"}
        className="h-full w-full rounded-md object-contain"
      />
    );
  }

  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <ImageIcon className="h-8 w-8" />
        <p className="text-sm">Creativo no disponible — re-sincronizar estructura</p>
      </div>
    </div>
  );
}

/**
 * When the creative lookup returns null we ask the server what this ID
 * actually is — an ad without cached media, an adset, a campaign, or
 * something we've never seen. The message is tailored so operators know
 * what to fix (sync creatives vs. fix UTM macros on the ad).
 */
function CreativeFallback({ adId }: { adId: string }) {
  const { data, isLoading } = trpc.metaAds.attributionInfoById.useQuery(
    { id: adId },
    { staleTime: 10 * 60_000 },
  );

  if (isLoading) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Buscando información del anuncio…
      </div>
    );
  }

  const kind = data?.kind ?? "unknown";

  if (kind === "ad_without_creative") {
    return (
      <div className="space-y-2 rounded-md border border-dashed p-6 text-sm">
        <p className="font-medium text-foreground">
          {data?.adName || "Anuncio"} <Badge variant="outline" className="ml-1">{data?.adStatus}</Badge>
        </p>
        <p className="text-muted-foreground">
          La estructura se sincronizó pero la metadata visual (video, thumbnail, copy) no llegó.
          Volvé a ejecutar <span className="font-mono">metaAds.syncStructure</span> — si el error persiste,
          el token de Meta probablemente no tiene permisos <span className="font-mono">ads_read</span>
          suficientes para leer <span className="font-mono">creative&#123;...&#125;</span>.
        </p>
        <p className="text-xs text-muted-foreground">Ad ID: {adId}</p>
      </div>
    );
  }

  if (kind === "campaign") {
    return (
      <div className="space-y-2 rounded-md border border-dashed p-6 text-sm">
        <p className="font-medium text-foreground">
          <Badge variant="secondary">Campaña</Badge> {data?.campaignName || adId}
        </p>
        <p className="text-muted-foreground">
          Este ID corresponde a una <b>campaña</b>, no a un anuncio. Revisá la URL del anuncio en Meta —
          el parámetro <span className="font-mono">utm_content</span> debería usar la macro{" "}
          <span className="font-mono">{"{{ad.id}}"}</span>, no <span className="font-mono">{"{{campaign.id}}"}</span>.
        </p>
        <p className="text-xs text-muted-foreground">Campaign ID: {adId}</p>
      </div>
    );
  }

  if (kind === "adset") {
    return (
      <div className="space-y-2 rounded-md border border-dashed p-6 text-sm">
        <p className="font-medium text-foreground">
          <Badge variant="secondary">Conjunto</Badge> {data?.adsetName || adId}
        </p>
        <p className="text-muted-foreground">
          Este ID corresponde a un <b>conjunto de anuncios</b>, no a un anuncio. Revisá la URL del anuncio
          — <span className="font-mono">utm_content</span> debería usar{" "}
          <span className="font-mono">{"{{ad.id}}"}</span>, no <span className="font-mono">{"{{adset.id}}"}</span>.
        </p>
        <p className="text-xs text-muted-foreground">Adset ID: {adId}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      <p>
        No hay creativo cacheado y este ID no matchea con ningún anuncio, conjunto ni campaña en cache.
        Ejecutá <span className="font-mono">metaAds.syncStructure</span> desde Marketing → Atribución.
      </p>
      <p className="text-xs">ID: {adId}</p>
    </div>
  );
}

/** The full modal that plays the video and shows title/body/CTA. */
function CreativeModal({
  adId,
  preloaded,
  adName,
  open,
  onOpenChange,
}: {
  adId: string;
  preloaded?: Creative | null;
  adName?: string | null;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  // Only fire the network request when the modal actually opens, unless we
  // already have the creative from a batch preload.
  const enabled = open && !preloaded;
  const { data, isLoading } = trpc.metaAds.creativeByAdId.useQuery(
    { adId },
    { enabled, staleTime: 10 * 60_000 }
  );
  const creative: Creative | null = preloaded ?? (data as Creative | null) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {creative?.title || adName || "Creativo del anuncio"}
          </DialogTitle>
          {creative?.callToActionType ? (
            <DialogDescription>
              <Badge variant="secondary" className="uppercase">
                {creative.callToActionType.replace(/_/g, " ")}
              </Badge>
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {isLoading && !creative ? (
          <div className="flex aspect-video w-full animate-pulse items-center justify-center rounded-md bg-muted text-muted-foreground">
            Cargando creativo…
          </div>
        ) : creative ? (
          <div className="space-y-4">
            <CreativeMedia creative={creative} />
            {creative.body ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {creative.body}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {creative.destinationUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={creative.destinationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Abrir landing
                  </a>
                </Button>
              ) : null}
              {creative.videoPermalinkUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={creative.videoPermalinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Ver en Meta
                  </a>
                </Button>
              ) : null}
              {creative.instagramPermalinkUrl ? (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={creative.instagramPermalinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Ver en Instagram
                  </a>
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">Ad ID: {adId}</p>
          </div>
        ) : (
          <CreativeFallback adId={adId} />
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdCreativePreview({
  adId,
  preloaded,
  adName,
  variant = "compact",
  className,
}: AdCreativePreviewProps) {
  const [open, setOpen] = useState(false);

  // Guard rail: if no adId, just render a static placeholder so layout doesn't
  // shift when `utm_content` wasn't a valid Meta adId.
  if (!adId) {
    return <CreativePlaceholder size={variant === "compact" ? 48 : 96} />;
  }

  // When we don't have a preload *and* the component is compact, we avoid
  // firing the query until the modal opens — the thumb uses whatever preload
  // was handed in, or a placeholder.
  const creative: Creative | null = preloaded ?? null;

  if (variant === "compact") {
    return (
      <div className={className}>
        <CompactThumb creative={creative} onOpen={() => setOpen(true)} adName={adName} />
        {open ? (
          <CreativeModal
            adId={adId}
            preloaded={preloaded ?? undefined}
            adName={adName}
            open={open}
            onOpenChange={setOpen}
          />
        ) : null}
      </div>
    );
  }

  // Inline variant — render a small card directly in-place with thumb + title.
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-md border p-2 text-left transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <CompactThumb creative={creative} onOpen={() => setOpen(true)} adName={adName} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {creative?.title || adName || "Creativo del anuncio"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {creative?.body || "Ad ID: " + adId}
          </p>
        </div>
      </button>
      {open ? (
        <CreativeModal
          adId={adId}
          preloaded={preloaded ?? undefined}
          adName={adName}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </div>
  );
}
