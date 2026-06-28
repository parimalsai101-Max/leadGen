import { NextResponse } from "next/server";
import { Country, State, City } from "country-state-city";

export const runtime = "nodejs";

// Cascading location data for the Country → State → City pickers.
//   /api/locations                       → { countries }
//   /api/locations?country=US            → { states }
//   /api/locations?country=US&state=TX   → { cities }
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const country = sp.get("country");
  const state = sp.get("state");

  if (country && state) {
    const cities = [...new Set(City.getCitiesOfState(country, state).map((c) => c.name))].sort();
    return NextResponse.json({ cities });
  }
  if (country) {
    const states = State.getStatesOfCountry(country).map((s) => ({ name: s.name, isoCode: s.isoCode }));
    return NextResponse.json({ states });
  }
  const countries = Country.getAllCountries().map((c) => ({ name: c.name, isoCode: c.isoCode }));
  return NextResponse.json({ countries });
}
