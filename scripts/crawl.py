import asyncio, json, sys
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig

async def scrape_url(crawler, url):
    config = CrawlerRunConfig(
        word_count_threshold=0,
        remove_overlay_elements=True,
    )
    result = await crawler.arun(url=url, config=config)
    if not result.success:
        return {"success": False, "error": result.error_message or "Scrape failed"}

    meta = result.metadata or {}
    internal_links = [l.get("href", "") for l in (result.links.get("internal") or []) if l.get("href")]
    external_links = [l.get("href", "") for l in (result.links.get("external") or []) if l.get("href")]

    return {
        "success": True,
        "statusCode": result.status_code,
        "markdown": result.markdown or "",
        "metadata": {
            "url": meta.get("url") or result.url or url,
            "statusCode": result.status_code,
            "title": meta.get("title"),
            "description": meta.get("description"),
            "ogTitle": meta.get("ogTitle") or meta.get("og:title"),
            "ogDescription": meta.get("ogDescription") or meta.get("og:description"),
            "ogImage": meta.get("ogImage") or meta.get("og:image"),
            "favicon": meta.get("favicon"),
        },
        "internalLinks": len(internal_links),
        "externalLinks": len(external_links),
        "links": {
            "internal": internal_links,
            "external": external_links,
        },
    }

async def main():
    url = sys.argv[1] if len(sys.argv) > 1 else ""
    if not url:
        print(json.dumps({"success": False, "error": "No URL provided"}))
        return
    try:
        async with AsyncWebCrawler() as crawler:
            data = await scrape_url(crawler, url)
        print(json.dumps(data))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

asyncio.run(main())
