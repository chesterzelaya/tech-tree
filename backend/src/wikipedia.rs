use crate::types::{Result, WikipediaPage};
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
struct WikipediaApiResponse {
    query: WikipediaQuery,
}

#[derive(Debug, Deserialize)]
struct WikipediaQuery {
    pages: HashMap<String, WikipediaPageData>,
}

#[derive(Debug, Deserialize)]
struct WikipediaPageData {
    pageid: Option<u64>,
    title: Option<String>,
    extract: Option<String>,
    missing: Option<bool>,
}

pub struct WikipediaClient {
    client: Client,
    base_url: String,
}

impl WikipediaClient {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .user_agent("WikiEngineBackend/1.0 (Educational Purpose)")
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            base_url: "https://en.wikipedia.org/api/rest_v1".to_string(),
        }
    }

    pub async fn search_pages(&self, query: &str, limit: u8) -> Result<Vec<String>> {
        let url = format!(
            "https://en.wikipedia.org/w/api.php?action=opensearch&format=json&search={}&limit={}",
            urlencoding::encode(query),
            limit
        );

        let response = self.client.get(&url).send().await?;
        let results: serde_json::Value = response.json().await?;

        if let Some(titles) = results.get(1).and_then(|v| v.as_array()) {
            Ok(titles
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect())
        } else {
            Ok(vec![])
        }
    }

    pub async fn get_page_extract(&self, title: &str) -> Result<Option<WikipediaPage>> {
        let url = format!(
            "https://en.wikipedia.org/w/api.php?action=query&format=json&titles={}&prop=extracts&exintro=&explaintext=&exsectionformat=plain",
            urlencoding::encode(title)
        );

        let response = self.client.get(&url).send().await?;
        let api_response: WikipediaApiResponse = response.json().await?;

        for (_, page_data) in api_response.query.pages {
            if page_data.missing.unwrap_or(false) {
                return Ok(None);
            }

            if let (Some(page_title), Some(extract), Some(page_id)) =
                (page_data.title, page_data.extract, page_data.pageid)
            {
                return Ok(Some(WikipediaPage {
                    title: page_title.clone(),
                    extract,
                    url: format!("https://en.wikipedia.org/wiki/{}", 
                        urlencoding::encode(&page_title)),
                    page_id,
                }));
            }
        }

        Ok(None)
    }

    pub async fn get_page_sections(&self, title: &str) -> Result<Vec<String>> {
        let url = format!(
            "https://en.wikipedia.org/w/api.php?action=parse&format=json&page={}&prop=sections",
            urlencoding::encode(title)
        );

        let response = self.client.get(&url).send().await?;
        let result: serde_json::Value = response.json().await?;

        if let Some(sections) = result
            .get("parse")
            .and_then(|p| p.get("sections"))
            .and_then(|s| s.as_array())
        {
            Ok(sections
                .iter()
                .filter_map(|section| {
                    section.get("line").and_then(|line| line.as_str().map(|s| s.to_string()))
                })
                .collect())
        } else {
            Ok(vec![])
        }
    }

    pub async fn get_page_links(&self, title: &str, limit: u8) -> Result<Vec<String>> {
        let url = format!(
            "https://en.wikipedia.org/w/api.php?action=query&format=json&titles={}&prop=links&pllimit={}",
            urlencoding::encode(title),
            limit
        );

        let response = self.client.get(&url).send().await?;
        let result: serde_json::Value = response.json().await?;

        if let Some(pages) = result.get("query").and_then(|q| q.get("pages")) {
            for (_, page) in pages.as_object().unwrap_or(&serde_json::Map::new()) {
                if let Some(links) = page.get("links").and_then(|l| l.as_array()) {
                    return Ok(links
                        .iter()
                        .filter_map(|link| {
                            link.get("title").and_then(|t| t.as_str().map(|s| s.to_string()))
                        })
                        .filter(|title| !title.starts_with("Category:") && !title.starts_with("File:"))
                        .collect());
                }
            }
        }

        Ok(vec![])
    }

    pub async fn batch_get_extracts(&self, titles: &[String]) -> Result<Vec<WikipediaPage>> {
        if titles.is_empty() {
            return Ok(vec![]);
        }

        let titles_str = titles.join("|");
        let url = format!(
            "https://en.wikipedia.org/w/api.php?action=query&format=json&titles={}&prop=extracts&exintro=&explaintext=&exsectionformat=plain",
            urlencoding::encode(&titles_str)
        );

        let response = self.client.get(&url).send().await?;
        let api_response: WikipediaApiResponse = response.json().await?;

        let mut results = Vec::new();
        for (_, page_data) in api_response.query.pages {
            if page_data.missing.unwrap_or(false) {
                continue;
            }

            if let (Some(page_title), Some(extract), Some(page_id)) =
                (page_data.title, page_data.extract, page_data.pageid)
            {
                results.push(WikipediaPage {
                    title: page_title.clone(),
                    extract,
                    url: format!("https://en.wikipedia.org/wiki/{}", 
                        urlencoding::encode(&page_title)),
                    page_id,
                });
            }
        }

        Ok(results)
    }
}