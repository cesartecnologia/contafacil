import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, Cloud, CloudRain, CloudSun, Sun, Thermometer } from "lucide-react";

type WeatherState = {
  temperature: number | null;
  label: string;
  code: number | null;
};

function getWeatherLabel(code: number | null) {
  if (code === null) return "Clima";
  if ([0].includes(code)) return "Céu limpo";
  if ([1, 2].includes(code)) return "Parcialmente nublado";
  if ([3].includes(code)) return "Nublado";
  if ([45, 48].includes(code)) return "Neblina";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Chuva";
  if ([95, 96, 99].includes(code)) return "Trovoadas";
  return "Clima";
}

function getWeatherIcon(code: number | null) {
  if (code === null) return CloudSun;
  if ([0].includes(code)) return Sun;
  if ([1, 2].includes(code)) return CloudSun;
  if ([3, 45, 48].includes(code)) return Cloud;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return CloudRain;
  return CloudSun;
}

export function DashboardWidgets() {
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<WeatherState>({
    temperature: null,
    label: "Clima",
    code: null,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadWeather() {
      try {
        const response = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=-17.7281&longitude=-42.2647&current=temperature_2m,weather_code&timezone=America%2FSao_Paulo",
          { cache: "no-store" },
        );

        if (!response.ok) return;

        const data = await response.json();
        const code = typeof data?.current?.weather_code === "number" ? data.current.weather_code : null;
        const temperature =
          typeof data?.current?.temperature_2m === "number"
            ? Math.round(data.current.temperature_2m)
            : null;

        if (!active) return;

        setWeather({
          temperature,
          code,
          label: getWeatherLabel(code),
        });
      } catch {
        if (!active) return;
      }
    }

    loadWeather();
    const timer = window.setInterval(loadWeather, 1000 * 60 * 20);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const formattedDate = useMemo(() => {
    return now
      .toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      })
      .replace(".", "");
  }, [now]);

  const formattedTime = useMemo(() => {
    return now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [now]);

  const WeatherIcon = getWeatherIcon(weather.code);

  return (
    <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
      <div className="flex items-center gap-2 rounded-2xl border border-white/50 bg-white/70 px-3 py-2 text-sm shadow-sm backdrop-blur-xl">
        <CalendarDays className="h-4 w-4 text-red-600" />
        <span className="font-medium capitalize text-zinc-700">{formattedDate}</span>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-white/50 bg-white/70 px-3 py-2 text-sm shadow-sm backdrop-blur-xl">
        <Clock3 className="h-4 w-4 text-red-600" />
        <span className="font-semibold text-zinc-900">{formattedTime}</span>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-white/50 bg-white/70 px-3 py-2 text-sm shadow-sm backdrop-blur-xl">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <WeatherIcon className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="flex items-center gap-1 font-semibold text-zinc-900">
            <Thermometer className="h-3.5 w-3.5 text-red-500" />
            {weather.temperature !== null ? `${weather.temperature}°C` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">{weather.label}</p>
        </div>
      </div>
    </div>
  );
}

export default DashboardWidgets;
