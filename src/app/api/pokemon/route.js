export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  const url = `https://api.pokemontcg.io/v2/cards?pageSize=24&orderBy=-set.releaseDate${q ? `&q=${q}` : ''}`;

  const res = await fetch(url, {
    headers: { 'X-Api-Key': '59b12420-8078-41b2-833b-2d9ae8a4b80d' }
  });

  const data = await res.json();
  return Response.json(data);
}