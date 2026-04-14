import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Check, CheckCheck, ExternalLink, MessageCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

const NOTIFICATION_SOUND_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310519663172432285/FJutJ9PtonH8caxBfk3FHF/notification-chime_97dc0409.wav";
const POLL_INTERVAL = 60_000; // 60 seconds

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const lastCheckRef = useRef<string>(new Date().toISOString());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevCountRef = useRef<number>(0);
  const utils = trpc.useUtils();

  // Preload audio
  useEffect(() => {
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.volume = 0.5;
    audio.preload = "auto";
    audioRef.current = audio;
  }, []);

  // Unread count query
  const { data: unreadCount = 0 } = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: POLL_INTERVAL,
  });

  // Full notifications list (only when popover is open)
  const { data: notifications = [], isLoading } = trpc.notifications.list.useQuery(
    { limit: 30 },
    { enabled: open }
  );

  // Play sound and show desktop notification when unread count increases
  useEffect(() => {
    if (unreadCount > prevCountRef.current && prevCountRef.current >= 0) {
      // Play sound
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }

      // Request desktop notification permission if not already granted
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }

      // Show desktop notification
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification("Sacamedi CRM", {
            body: "Tienes nuevas notificaciones",
            icon: "/favicon.ico",
            tag: "sacamedi-notification",
          });
        } catch {
          // Ignore errors (e.g., in some browsers)
        }
      }
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  // Mark single notification as read
  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  // Mark all as read
  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  const handleNotificationClick = useCallback((notif: any) => {
    // Mark as read
    if (!notif.isRead) {
      markReadMutation.mutate({ id: notif.id });
    }
    // Navigate to the lead if there's a leadId
    if (notif.leadId) {
      setLocation(`/citas?leadId=${notif.leadId}`);
      setOpen(false);
    }
  }, [markReadMutation, setLocation]);

  const formatTime = (dateStr: string | Date) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "Ahora";
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHr < 24) return `${diffHr}h`;
    if (diffDay < 7) return `${diffDay}d`;
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
          aria-label="Notificaciones"
          title="Notificaciones"
        >
          <Bell className={`h-4 w-4 ${unreadCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-in zoom-in-50">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="right"
        className="w-80 p-0 bg-popover text-popover-foreground border-border shadow-xl"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Notificaciones</span>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Leer todo
            </Button>
          )}
        </div>

        {/* Notifications list */}
        <ScrollArea className="max-h-[360px]">
          {isLoading ? (
            <div className="text-center py-8 text-xs text-muted-foreground">Cargando...</div>
          ) : (notifications as any[]).length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
              <p className="text-xs text-muted-foreground">Sin notificaciones</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Las menciones aparecerán aquí</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {(notifications as any[]).map((notif: any) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors ${
                    !notif.isRead ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {/* Icon */}
                    <div className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                      !notif.isRead ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {notif.type === "mention" ? (
                        <MessageCircle className="h-3.5 w-3.5" />
                      ) : (
                        <Bell className="h-3.5 w-3.5" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${!notif.isRead ? "font-medium text-foreground" : "text-foreground/70"}`}>
                        {notif.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground/50">
                          {formatTime(notif.createdAt)}
                        </span>
                        {notif.leadId && (
                          <span className="text-[10px] text-primary/60 flex items-center gap-0.5">
                            <ExternalLink className="h-2.5 w-2.5" />
                            Ver lead
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Unread dot */}
                    {!notif.isRead && (
                      <div className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
