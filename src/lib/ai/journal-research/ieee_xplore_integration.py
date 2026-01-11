#!/usr/bin/env python3
"""
IEEE Xplore Integration for Journal Research Pipeline

This module provides comprehensive integration with IEEE Xplore Digital Library
for accessing research papers, conference proceedings, and standards related to:
- AI bias detection and fairness
- Healthcare technology and ethics
- Machine learning in healthcare
- Digital health and privacy

Features:
- Advanced search with multiple criteria
- Rate limiting and caching
- Metadata extraction and normalization
- Citation analysis and impact metrics
- Integration with existing research pipeline
"""

import asyncio
import json
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, Set
from urllib.parse import urlencode, quote_plus
import aiohttp
import xml.etree.ElementTree as ET
from tenacity import retry, stop_after_attempt, wait_exponential

# Import existing components
from research_pipeline import ResearchPaper, ResearchMetadata, SearchCriteria
from bias_detection.sentry_metrics import research_metrics, track_latency

logger = logging.getLogger(__name__)


@dataclass
class IEEESearchConfig:
    """Configuration for IEEE Xplore API integration"""
    api_key: str
    base_url: str = "https://ieeexplore.ieee.org/api/v1"
    search_endpoint: str = "/search"
    metadata_endpoint: str = "/metadata"
    citation_endpoint: str = "/citations"
    max_results_per_request: int = 100
    max_total_results: int = 1000
    rate_limit_delay: float = 0.5  # seconds between requests
    cache_ttl: int = 3600  # 1 hour cache TTL
    enable_caching: bool = True
    enable_rate_limiting: bool = True
    timeout: int = 30


@dataclass
class IEEEPaper:
    """IEEE Xplore paper data structure"""
    paper_id: str
    title: str
    authors: List[Dict[str, str]]
    abstract: str
    publication_title: str
    publication_year: int
    doi: Optional[str] = None
    keywords: List[str] = field(default_factory=list)
    citation_count: int = 0
    impact_factor: float = 0.0
    pdf_url: Optional[str] = None
    html_url: Optional[str] = None
    publication_type: str = "journal"  # journal, conference, standard
    ieee_terms: List[str] = field(default_factory=list)
    mesh_terms: List[str] = field(default_factory=list)
    references: List[str] = field(default_factory=list)
    citations: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    relevance_score: float = 0.0
    bias_relevance_score: float = 0.0


@dataclass
class IEEESearchCriteria:
    """Enhanced search criteria for IEEE Xplore"""
    query: str
    publication_years: Optional[Tuple[int, int]] = None
    publication_types: Optional[List[str]] = None  # journal, conference, standard
    subject_areas: Optional[List[str]] = None
    authors: Optional[List[str]] = None
    affiliations: Optional[List[str]] = None
    keywords: Optional[List[str]] = None
    ieee_terms: Optional[List[str]] = None
    mesh_terms: Optional[List[str]] = None
    min_citations: int = 0
    min_impact_factor: float = 0.0
    content_type: str = "papers"  # papers, standards, conferences
    sort_by: str = "relevance"  # relevance, date, citations, impact_factor
    order: str = "desc"
    max_results: int = 100


class IEEEXploreClient:
    """IEEE Xplore API client with advanced features"""
    
    def __init__(self, config: IEEESearchConfig):
        self.config = config
        self.session: Optional[aiohttp.ClientSession] = None
        self.request_count = 0
        self.last_request_time = 0.0
        self.cache: Dict[str, Any] = {}
        self.cache_timestamps: Dict[str, float] = {}
        
    async def __aenter__(self):
        """Async context manager entry"""
        await self._ensure_session()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()
        
    async def _ensure_session(self) -> None:
        """Ensure HTTP session is created"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self.config.timeout),
                headers={
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'PixelatedEmpathy/1.0'
                }
            )
    
    async def close(self) -> None:
        """Close HTTP session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    def _rate_limit(self) -> None:
        """Apply rate limiting"""
        if not self.config.enable_rate_limiting:
            return
        
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        
        if time_since_last < self.config.rate_limit_delay:
            sleep_time = self.config.rate_limit_delay - time_since_last
            time.sleep(sleep_time)
        
        self.last_request_time = time.time()
    
    def _get_cache_key(self, endpoint: str, params: Dict[str, Any]) -> str:
        """Generate cache key for request"""
        param_str = urlencode(sorted(params.items()))
        return f"{endpoint}:{hash(param_str)}"
    
    def _get_cached_result(self, cache_key: str) -> Optional[Any]:
        """Get cached result if available"""
        if not self.config.enable_caching:
            return None
        
        if cache_key in self.cache:
            cache_time = self.cache_timestamps.get(cache_key, 0)
            if time.time() - cache_time < self.config.cache_ttl:
                return self.cache[cache_key]
            else:
                # Expired cache entry
                del self.cache[cache_key]
                del self.cache_timestamps[cache_key]
        
        return None
    
    def _set_cached_result(self, cache_key: str, result: Any) -> None:
        """Set cached result"""
        if not self.config.enable_caching:
            return
        
        self.cache[cache_key] = result
        self.cache_timestamps[cache_key] = time.time()
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def _make_request(self, endpoint: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Make authenticated request to IEEE Xplore API"""
        await self._ensure_session()
        
        # Apply rate limiting
        self._rate_limit()
        
        # Check cache
        cache_key = self._get_cache_key(endpoint, params)
        cached_result = self._get_cached_result(cache_key)
        if cached_result:
            return cached_result
        
        # Build request URL
        url = f"{self.config.base_url}{endpoint}"
        params['api_key'] = self.config.api_key
        
        try:
            async with self.session.get(url, params=params) as response:
                self.request_count += 1
                
                if response.status == 200:
                    result = await response.json()
                    self._set_cached_result(cache_key, result)
                    return result
                elif response.status == 429:
                    # Rate limit exceeded
                    retry_after = int(response.headers.get('Retry-After', 60))
                    logger.warning(f"Rate limit exceeded, retrying after {retry_after}s")
                    await asyncio.sleep(retry_after)
                    raise aiohttp.ClientError("Rate limit exceeded")
                else:
                    error_text = await response.text()
                    logger.error(f"IEEE API error {response.status}: {error_text}")
                    raise aiohttp.ClientError(f"IEEE API error {response.status}")
                    
        except Exception as e:
            logger.error(f"Request failed for endpoint {endpoint}: {e}")
            raise
    
    async def search_papers(self, criteria: IEEESearchCriteria) -> List[IEEEPaper]:
        """Search for papers using enhanced criteria"""
        params = {
            'querytext': criteria.query,
            'max_records': min(criteria.max_results, self.config.max_results_per_request),
            'sort_order': criteria.sort_by,
            'sort_order_dir': criteria.order,
            'content_type': criteria.content_type
        }
        
        # Add advanced search parameters
        if criteria.publication_years:
            params['start_year'] = criteria.publication_years[0]
            params['end_year'] = criteria.publication_years[1]
        
        if criteria.publication_types:
            params['publication_type'] = ','.join(criteria.publication_types)
        
        if criteria.subject_areas:
            params['subject_area'] = ','.join(criteria.subject_areas)
        
        if criteria.authors:
            params['author'] = ','.join(criteria.authors)
        
        if criteria.keywords:
            params['keywords'] = ','.join(criteria.keywords)
        
        if criteria.min_citations > 0:
            params['min_citations'] = criteria.min_citations
        
        try:
            response = await self._make_request(self.config.search_endpoint, params)
            papers = self._parse_search_results(response)
            
            # Calculate relevance scores
            for paper in papers:
                paper.relevance_score = self._calculate_relevance_score(paper, criteria)
                paper.bias_relevance_score = self._calculate_bias_relevance_score(paper)
            
            # Sort by relevance
            papers.sort(key=lambda x: x.relevance_score, reverse=True)
            
            logger.info(f"IEEE search completed: {len(papers)} papers found")
            return papers
            
        except Exception as e:
            logger.error(f"IEEE search failed: {e}")
            return []
    
    def _parse_search_results(self, response: Dict[str, Any]) -> List[IEEEPaper]:
        """Parse IEEE search results"""
        papers = []
        
        if 'articles' not in response:
            return papers
        
        for article in response['articles']:
            try:
                paper = IEEEPaper(
                    paper_id=str(article.get('article_number', '')),
                    title=article.get('title', ''),
                    authors=self._parse_authors(article.get('authors', {})),
                    abstract=article.get('abstract', ''),
                    publication_title=article.get('publication_title', ''),
                    publication_year=int(article.get('publication_year', 0)),
                    doi=article.get('doi'),
                    keywords=article.get('keywords', []),
                    citation_count=int(article.get('citation_count', 0)),
                    pdf_url=article.get('pdf_url'),
                    html_url=article.get('html_url'),
                    publication_type=article.get('content_type', 'journal'),
                    ieee_terms=article.get('ieee_terms', []),
                    mesh_terms=article.get('mesh_terms', []),
                    metadata=article
                )
                
                papers.append(paper)
                
            except Exception as e:
                logger.error(f"Failed to parse IEEE article: {e}")
                continue
        
        return papers
    
    def _parse_authors(self, authors_data: Any) -> List[Dict[str, str]]:
        """Parse author information"""
        authors = []
        
        if isinstance(authors_data, dict):
            for author in authors_data.get('authors', []):
                authors.append({
                    'name': author.get('full_name', ''),
                    'affiliation': author.get('affiliation', ''),
                    'email': author.get('email', '')
                })
        elif isinstance(authors_data, list):
            for author in authors_data:
                if isinstance(author, dict):
                    authors.append({
                        'name': author.get('full_name', author.get('name', '')),
                        'affiliation': author.get('affiliation', ''),
                        'email': author.get('email', '')
                    })
        
        return authors
    
    def _calculate_relevance_score(self, paper: IEEEPaper, criteria: IEEESearchCriteria) -> float:
        """Calculate relevance score based on search criteria"""
        score = 0.0
        
        # Base score from publication type
        if paper.publication_type == 'journal':
            score += 1.0
        elif paper.publication_type == 'conference':
            score += 0.8
        elif paper.publication_type == 'standard':
            score += 0.6
        
        # Recency score
        current_year = datetime.now().year
        if paper.publication_year > 0:
            age = current_year - paper.publication_year
            recency_score = max(0.1, 1.0 - (age / 20.0))  # Decay over 20 years
            score += recency_score
        
        # Citation impact score
        if paper.citation_count > 0:
            citation_score = min(1.0, paper.citation_count / 100.0)
            score += citation_score
        
        # Keyword matching score
        if criteria.keywords:
            title_keywords = set(paper.title.lower().split())
            abstract_keywords = set(paper.abstract.lower().split())
            search_keywords = set(k.lower() for k in criteria.keywords)
            
            title_matches = len(title_keywords.intersection(search_keywords))
            abstract_matches = len(abstract_keywords.intersection(search_keywords))
            
            keyword_score = (title_matches * 0.3 + abstract_matches * 0.1) / len(search_keywords)
            score += min(0.5, keyword_score)
        
        return min(5.0, score)  # Cap at 5.0
    
    def _calculate_bias_relevance_score(self, paper: IEEEPaper) -> float:
        """Calculate bias-specific relevance score"""
        score = 0.0
        
        # Bias-related keywords
        bias_keywords = {
            'bias', 'fairness', 'equity', 'discrimination', 'ethics',
            'algorithmic fairness', 'machine learning bias', 'ai ethics',
            'healthcare disparities', 'demographic parity', 'equalized odds',
            'fairness constraints', 'bias mitigation', 'ethical ai'
        }
        
        # Check title and abstract for bias-related terms
        title_text = paper.title.lower()
        abstract_text = paper.abstract.lower()
        
        title_matches = sum(1 for keyword in bias_keywords if keyword in title_text)
        abstract_matches = sum(1 for keyword in bias_keywords if keyword in abstract_text)
        
        score += title_matches * 0.3 + abstract_matches * 0.1
        
        # Check IEEE terms
        ieee_bias_terms = [term for term in paper.ieee_terms if any(bias_word in term.lower() for bias_word in bias_keywords)]
        score += len(ieee_bias_terms) * 0.2
        
        # Check mesh terms
        mesh_bias_terms = [term for term in paper.mesh_terms if any(bias_word in term.lower() for bias_word in bias_keywords)]
        score += len(mesh_bias_terms) * 0.15
        
        return min(3.0, score)  # Cap at 3.0
    
    async def get_paper_metadata(self, paper_id: str) -> Optional[IEEEPaper]:
        """Get detailed metadata for a specific paper"""
        params = {'article_number': paper_id}
        
        try:
            response = await self._make_request(self.config.metadata_endpoint, params)
            return self._parse_paper_metadata(response)
            
        except Exception as e:
            logger.error(f"Failed to get metadata for paper {paper_id}: {e}")
            return None
    
    def _parse_paper_metadata(self, response: Dict[str, Any]) -> Optional[IEEEPaper]:
        """Parse detailed paper metadata"""
        if 'article' not in response:
            return None
        
        article = response['article']
        
        return IEEEPaper(
            paper_id=str(article.get('article_number', '')),
            title=article.get('title', ''),
            authors=self._parse_authors(article.get('authors', {})),
            abstract=article.get('abstract', ''),
            publication_title=article.get('publication_title', ''),
            publication_year=int(article.get('publication_year', 0)),
            doi=article.get('doi'),
            keywords=article.get('keywords', []),
            citation_count=int(article.get('citation_count', 0)),
            impact_factor=float(article.get('impact_factor', 0.0)),
            pdf_url=article.get('pdf_url'),
            html_url=article.get('html_url'),
            publication_type=article.get('content_type', 'journal'),
            ieee_terms=article.get('ieee_terms', []),
            mesh_terms=article.get('mesh_terms', []),
            references=article.get('references', []),
            citations=article.get('citations', []),
            metadata=article
        )
    
    async def get_citation_analysis(self, paper_id: str) -> Dict[str, Any]:
        """Get citation analysis for a paper"""
        params = {'article_number': paper_id}
        
        try:
            response = await self._make_request(self.config.citation_endpoint, params)
            return self._parse_citation_analysis(response)
            
        except Exception as e:
            logger.error(f"Failed to get citation analysis for paper {paper_id}: {e}")
            return {}
    
    def _parse_citation_analysis(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Parse citation analysis results"""
        return {
            'total_citations': response.get('total_citations', 0),
            'recent_citations': response.get('recent_citations', 0),
            'citation_trend': response.get('citation_trend', 'stable'),
            'highly_cited': response.get('highly_cited', False),
            'citation_velocity': response.get('citation_velocity', 0.0),
            'influence_score': response.get('influence_score', 0.0)
        }


class IEEEResearchPipeline:
    """Integration with existing research pipeline"""
    
    def __init__(self, client: IEEEXploreClient):
        self.client = client
        self.bias_keywords = self._load_bias_keywords()
        
    def _load_bias_keywords(self) -> Set[str]:
        """Load bias-related keywords for enhanced searching"""
        return {
            'algorithmic bias', 'machine learning bias', 'ai bias', 'bias detection',
            'fairness in ai', 'ethical ai', 'algorithmic fairness', 'bias mitigation',
            'demographic parity', 'equalized odds', 'fairness constraints',
            'healthcare disparities', 'medical bias', 'clinical bias',
            'diagnostic bias', 'treatment bias', 'health equity',
            'algorithmic accountability', 'ai ethics', 'responsible ai',
            'bias in healthcare', 'healthcare equity', 'medical ethics',
            'clinical decision support', 'healthcare algorithms',
            'patient safety', 'healthcare quality', 'health disparities'
        }
    
    @track_latency("research.ieee_pipeline_search")
    async def search_bias_related_papers(
        self,
        query: str,
        max_results: int = 50,
        publication_years: Optional[Tuple[int, int]] = None,
        min_citations: int = 5
    ) -> List[ResearchPaper]:
        """Search for bias-related papers with enhanced criteria"""
        
        # Build enhanced search criteria
        criteria = IEEESearchCriteria(
            query=query,
            max_results=max_results,
            publication_years=publication_years,
            min_citations=min_citations,
            keywords=list(self.bias_keywords),
            subject_areas=[
                'Computing and Processing', 'Engineering Profession',
                'Signal Processing and Analysis', 'Bioengineering',
                'Communication, Networking and Broadcast Technologies',
                'Components, Circuits, Devices and Systems'
            ],
            publication_types=['journal', 'conference'],
            sort_by='relevance',
            content_type='papers'
        )
        
        # Search IEEE Xplore
        ieee_papers = await self.client.search_papers(criteria)
        
        # Convert to ResearchPaper format
        research_papers = []
        for ieee_paper in ieee_papers:
            research_paper = self._convert_to_research_paper(ieee_paper)
            if research_paper:
                research_papers.append(research_paper)
        
        logger.info(f"IEEE pipeline search completed: {len(research_papers)} papers")
        return research_papers
    
    def _convert_to_research_paper(self, ieee_paper: IEEEPaper) -> Optional[ResearchPaper]:
        """Convert IEEE paper to ResearchPaper format"""
        try:
            # Extract metadata
            metadata = ResearchMetadata(
                title=ieee_paper.title,
                authors=[author['name'] for author in ieee_paper.authors],
                publication=ieee_paper.publication_title,
                year=ieee_paper.publication_year,
                doi=ieee_paper.doi,
                abstract=ieee_paper.abstract,
                keywords=ieee_paper.keywords,
                citation_count=ieee_paper.citation_count,
                impact_factor=ieee_paper.impact_factor,
                url=ieee_paper.html_url or ieee_paper.pdf_url,
                pdf_url=ieee_paper.pdf_url,
                publication_type=ieee_paper.publication_type,
                mesh_terms=ieee_paper.mesh_terms,
                ieee_terms=ieee_paper.ieee_terms,
                references=ieee_paper.references,
                citations=ieee_paper.citations,
                relevance_score=ieee_paper.relevance_score,
                bias_relevance_score=ieee_paper.bias_relevance_score,
                source='ieee_xplore',
                metadata=ieee_paper.metadata
            )
            
            # Create ResearchPaper
            research_paper = ResearchPaper(
                paper_id=f"ieee_{ieee_paper.paper_id}",
                metadata=metadata,
                content={
                    'title': ieee_paper.title,
                    'abstract': ieee_paper.abstract,
                    'authors': ieee_paper.authors,
                    'keywords': ieee_paper.keywords,
                    'publication_info': {
                        'title': ieee_paper.publication_title,
                        'year': ieee_paper.publication_year,
                        'type': ieee_paper.publication_type
                    }
                },
                bias_analysis={
                    'relevance_score': ieee_paper.bias_relevance_score,
                    'keyword_matches': self._extract_bias_keywords(ieee_paper),
                    'methodology_focus': self._detect_methodology_focus(ieee_paper),
                    'applicability_score': self._calculate_applicability_score(ieee_paper)
                },
                quality_score=ieee_paper.relevance_score,
                confidence=min(0.95, ieee_paper.relevance_score / 5.0),
                source_reliability=0.9,  # IEEE is highly reliable
                extraction_date=datetime.now(timezone.utc),
                processing_status='completed'
            )
            
            return research_paper
            
        except Exception as e:
            logger.error(f"Failed to convert IEEE paper: {e}")
            return None
    
    def _extract_bias_keywords(self, ieee_paper: IEEEPaper) -> List[str]:
        """Extract bias-related keywords from paper"""
        found_keywords = []
        
        # Combine all text content
        all_text = f"{ieee_paper.title} {ieee_paper.abstract} {' '.join(ieee_paper.keywords)}"
        all_text_lower = all_text.lower()
        
        # Check for bias keywords
        for keyword in self.bias_keywords:
            if keyword in all_text_lower:
                found_keywords.append(keyword)
        
        return found_keywords
    
    def _detect_methodology_focus(self, ieee_paper: IEEEPaper) -> str:
        """Detect if paper focuses on methodology, application, or theory"""
        methodology_keywords = {
            'method', 'algorithm', 'approach', 'technique', 'framework',
            'methodology', 'procedure', 'process', 'system'
        }
        
        application_keywords = {
            'application', 'implementation', 'deployment', 'case study',
            'evaluation', 'assessment', 'experiment', 'study'
        }
        
        theory_keywords = {
            'theory', 'theoretical', 'analysis', 'model', 'formulation',
            'proof', 'theorem', 'lemma', 'conceptual'
        }
        
        text_content = f"{ieee_paper.title} {ieee_paper.abstract}".lower()
        
        methodology_count = sum(1 for keyword in methodology_keywords if keyword in text_content)
        application_count = sum(1 for keyword in application_keywords if keyword in text_content)
        theory_count = sum(1 for keyword in theory_keywords if keyword in text_content)
        
        if methodology_count >= application_count and methodology_count >= theory_count:
            return 'methodology'
        elif application_count >= methodology_count and application_count >= theory_count:
            return 'application'
        else:
            return 'theory'
    
    def _calculate_applicability_score(self, ieee_paper: IEEEPaper) -> float:
        """Calculate applicability score for bias detection research"""
        score = 0.0
        
        # Recent papers are more applicable
        current_year = datetime.now().year
        age = current_year - ieee_paper.publication_year
        recency_score = max(0.1, 1.0 - (age / 10.0))  # Decay over 10 years
        score += recency_score
        
        # High citation count indicates applicability
        if ieee_paper.citation_count > 0:
            citation_score = min(1.0, ieee_paper.citation_count / 50.0)
            score += citation_score
        
        # Journal papers are generally more applicable
        if ieee_paper.publication_type == 'journal':
            score += 0.5
        
        # Check for implementation keywords
        implementation_keywords = {
            'implementation', 'evaluation', 'assessment', 'framework',
            'tool', 'system', 'platform', 'software'
        }
        
        text_content = f"{ieee_paper.title} {ieee_paper.abstract}".lower()
        implementation_matches = sum(1 for keyword in implementation_keywords if keyword in text_content)
        
        score += min(1.0, implementation_matches * 0.2)
        
        return min(5.0, score)


# Global client instance
ieee_client: Optional[IEEEXploreClient] = None
ieee_pipeline: Optional[IEEEResearchPipeline] = None


async def initialize_ieee_client(config: Optional[IEEESearchConfig] = None) -> IEEEXploreClient:
    """Initialize global IEEE Xplore client"""
    global ieee_client
    
    if ieee_client is None:
        if config is None:
            # Load from environment or config file
            import os
            api_key = os.getenv('IEEE_API_KEY', 'demo_key')
            config = IEEESearchConfig(api_key=api_key)
        
        ieee_client = IEEEXploreClient(config)
        logger.info("IEEE Xplore client initialized")
    
    return ieee_client


async def get_ieee_pipeline() -> IEEEResearchPipeline:
    """Get global IEEE research pipeline instance"""
    global ieee_pipeline
    
    if ieee_pipeline is None:
        client = await initialize_ieee_client()
        ieee_pipeline = IEEEResearchPipeline(client)
        logger.info("IEEE research pipeline initialized")
    
    return ieee_pipeline


# API endpoints for IEEE Xplore integration
async def search_ieee_papers(
    query: str,
    max_results: int = 50,
    publication_years: Optional[Tuple[int, int]] = None,
    min_citations: int = 5
) -> List[ResearchPaper]:
    """API endpoint for IEEE paper search"""
    pipeline = await get_ieee_pipeline()
    return await pipeline.search_bias_related_papers(
        query=query,
        max_results=max_results,
        publication_years=publication_years,
        min_citations=min_citations
    )


async def get_ieee_paper_metadata(paper_id: str) -> Optional[IEEEPaper]:
    """API endpoint for IEEE paper metadata"""
    client = await initialize_ieee_client()
    return await client.get_paper_metadata(paper_id)


async def get_ieee_citation_analysis(paper_id: str) -> Dict[str, Any]:
    """API endpoint for IEEE citation analysis"""
    client = await initialize_ieee_client()
    return await client.get_citation_analysis(paper_id)


# Integration with main research pipeline
async def integrate_ieee_with_pipeline(
    search_criteria: SearchCriteria,
    pipeline_config: Dict[str, Any]
) -> List[ResearchPaper]:
    """Integrate IEEE Xplore results with main research pipeline"""
    
    # Convert pipeline search criteria to IEEE criteria
    ieee_criteria = IEEESearchCriteria(
        query=search_criteria.query,
        max_results=pipeline_config.get('max_results', 50),
        publication_years=(
            search_criteria.start_year,
            search_criteria.end_year
        ) if search_criteria.start_year and search_criteria.end_year else None,
        min_citations=pipeline_config.get('min_citations', 5),
        sort_by=pipeline_config.get('sort_by', 'relevance'),
        content_type='papers'
    )
    
    # Search IEEE Xplore
    client = await initialize_ieee_client()
    ieee_papers = await client.search_papers(ieee_criteria)
    
    # Convert to ResearchPaper format
    pipeline = await get_ieee_pipeline()
    research_papers = []
    
    for ieee_paper in ieee_papers:
        research_paper = pipeline._convert_to_research_paper(ieee_paper)
        if research_paper:
            research_papers.append(research_paper)
    
    # Track metrics
    research_metrics.papers_found(len(research_papers), 'ieee_xplore')
    
    return research_papers


if __name__ == "__main__":
    # Example usage
    async def example():
        # Initialize client
        pipeline = await get_ieee_pipeline()
        
        # Search for bias-related papers
        results = await pipeline.search_bias_related_papers(
            query="algorithmic bias healthcare machine learning",
            max_results=10,
            publication_years=(2020, 2024),
            min_citations=5
        )
        
        print(f"Found {len(results)} bias-related papers from IEEE Xplore")
        
        for paper in results[:3]:  # Show first 3 results
            print(f"\nTitle: {paper.metadata.title}")
            print(f"Authors: {', '.join(paper.metadata.authors)}")
            print(f"Year: {paper.metadata.year}")
            print(f"Relevance Score: {paper.quality_score}")
            print(f"Bias Relevance: {paper.bias_analysis.get('relevance_score', 0)}")
        
        # Shutdown
        if ieee_client:
            await ieee_client.close()

    asyncio.run(example())