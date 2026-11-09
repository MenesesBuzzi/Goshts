import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { File } from "expo-file-system";
import { buildMapHtml } from "./mapHtml";
import { mapRoot } from "./tiles";
import { C } from "../lib/theme";

/** pulse: 0 = normal; 1 a 3 = pedido disponível esperando demais (quanto maior, mais forte o pulso). wait = minutos esperando */
export type MapPin = { id: string; lat: number; lng: number; n: string; label: string; kind: "stop" | "avail" | "store"; pulse?: number; wait?: number };
/** Evento com bônus: centro, raio (m), título e texto do extra ("+R$ 2,00") */
export type MapEvent = { id: string; lat: number; lng: number; r: number; title: string; extra: string };
/** Célula de área de mais saída: w de 0 a 1 (intensidade) */
export type MapHeat = { lat: number; lng: number; w: number };
export type MapData = {
  me: { lat: number; lng: number } | null; pins: MapPin[]; route: [number, number][]; routeStraight: boolean; fit?: boolean;
  events?: MapEvent[]; heat?: MapHeat[];
  /** modo seguir: o mapa fica centrado no Ghost */
  follow?: boolean;
};
export type MapHandle = { center: () => void; fit: () => void; focus: (lat: number, lng: number, radiusM: number) => void };

/** meImg: foto (https) ou fantasminha (data:) do Ghost; meFallback: fantasminha para quando a foto não carregar (sem internet) */
type Props = { data: MapData; hasPack: boolean; meImg?: string; meFallback?: string; onTap?: (id: string) => void; onEventTap?: (id: string) => void; onFollowChange?: (on: boolean) => void };

/** Grava a página do mapa ao lado da pasta tiles/ e devolve o file:// dela */
function writeMapPage(hasPack: boolean) {
  const root = mapRoot();
  if (!root.exists) root.create({ intermediates: true, idempotent: true });
  const f = new File(root, "map.html");
  if (!f.exists) f.create();
  f.writeSync(buildMapHtml(hasPack));
  return f.uri;
}

export const MapWebView = forwardRef<MapHandle, Props>(function MapWebView({ data, hasPack, meImg, meFallback, onTap, onEventTap, onFollowChange }, ref) {
  // Os tipos do react-native-webview declaram WebView como FunctionComponent, mas em tempo de execução
  // ele aceita ref com injectJavaScript (forwardRef). Por isso o ref vai num spread tipado à parte.
  const web = useRef<{ injectJavaScript: (js: string) => void } | null>(null);
  const ready = useRef(false);
  const latest = useRef(data);
  latest.current = data;
  const [reloadKey, setReloadKey] = useState(0);
  const uri = useMemo(() => { ready.current = false; return writeMapPage(hasPack); }, [hasPack, reloadKey]);
  const rootUri = mapRoot().uri;

  const push = (d: MapData) => {
    if (!ready.current) return;
    web.current?.injectJavaScript(`window.fantasmaUpdate && window.fantasmaUpdate(${JSON.stringify(d)});true;`);
  };
  useEffect(() => { push(data); }, [data]);
  const meRef = useRef({ meImg, meFallback });
  meRef.current = { meImg, meFallback };
  const pushMe = () => {
    if (!ready.current) return;
    web.current?.injectJavaScript(`window.fantasmaSetMe && window.fantasmaSetMe(${JSON.stringify(meRef.current.meImg ?? "")}, ${JSON.stringify(meRef.current.meFallback ?? "")});true;`);
  };
  useEffect(() => { pushMe(); }, [meImg, meFallback]);

  useImperativeHandle(ref, () => ({
    center: () => web.current?.injectJavaScript("window.fantasmaCenter && window.fantasmaCenter();true;"),
    fit: () => push({ ...latest.current, fit: true }),
    focus: (lat, lng, r) => web.current?.injectJavaScript(`window.fantasmaFocus && window.fantasmaFocus(${Number(lat)}, ${Number(lng)}, ${Number(r)});true;`),
  }));

  function onMessage(e: WebViewMessageEvent) {
    let m: { type?: string; id?: string; on?: boolean };
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === "ready") { ready.current = true; pushMe(); push({ ...latest.current, fit: true }); }
    else if (m.type === "tap" && m.id) onTap?.(m.id);
    else if (m.type === "event" && m.id) onEventTap?.(m.id);
    else if (m.type === "follow") onFollowChange?.(!!m.on);
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <WebView
        key={uri + reloadKey}
        {...({ ref: web } as object)}
        source={{ uri }}
        originWhitelist={["*"]}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        allowingReadAccessToURL={rootUri}
        javaScriptEnabled
        domStorageEnabled
        onMessage={onMessage}
        onContentProcessDidTerminate={() => setReloadKey((k) => k + 1)}
        onRenderProcessGone={() => setReloadKey((k) => k + 1)}
        startInLoadingState
        renderLoading={() => <View style={[StyleSheet.absoluteFill, styles.loading]}><ActivityIndicator color={C.ghost} /></View>}
        style={{ backgroundColor: C.bg }}
        setBuiltInZoomControls={false}
        overScrollMode="never"
        bounces={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({ loading: { backgroundColor: C.bg, alignItems: "center", justifyContent: "center" } });
