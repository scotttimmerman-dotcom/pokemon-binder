export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    const url = `https://api.pokemontcg.io/v2/cards?pageSize=24&orderBy=-set.releaseDate${q ? `&q=${q}` : ''}`;

    const res = await fetch(url, {
      headers: { 'X-Api-Key': '59b12420-8078-41b2-833b-2d9ae8a4b80d' }
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Pokemon API error: ${res.status}` }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Route error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}