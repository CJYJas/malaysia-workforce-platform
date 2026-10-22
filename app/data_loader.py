"""
Data Loader for Malaysia Tech Workforce Intelligence Platform.
Handles ingestion of raw datasets (Jobstreet, Coursera, Meerawks) with error handling.
"""

import os
import logging
from typing import Optional
import pandas as pd
from app.config import Config, load_config

logger = logging.getLogger(__name__)


def load_jobstreet_data(filepath: Optional[str] = None, config: Optional[Config] = None) -> pd.DataFrame:
    """
    Loads raw JobStreet dataset.
    
    Args:
        filepath: Optional path override. If None, uses path from config.yaml.
        config: Optional Config instance.
    
    Returns:
        pd.DataFrame containing raw JobStreet listings.
    """
    cfg = config or load_config()
    target_path = os.path.abspath(filepath) if filepath else cfg.raw_jobstreet_path

    if not os.path.exists(target_path):
        raise FileNotFoundError(f"JobStreet raw dataset not found at: {target_path}")

    logger.info("Loading JobStreet dataset from %s", target_path)
    df = pd.read_csv(target_path, low_memory=False)
    logger.info("Successfully loaded %d raw JobStreet rows.", len(df))
    return df


def load_coursera_data(filepath: Optional[str] = None, config: Optional[Config] = None) -> pd.DataFrame:
    """
    Loads raw Coursera dataset.
    
    Args:
        filepath: Optional path override. If None, uses path from config.yaml.
        config: Optional Config instance.
    
    Returns:
        pd.DataFrame containing Coursera courses.
    """
    cfg = config or load_config()
    target_path = os.path.abspath(filepath) if filepath else cfg.raw_coursera_path

    if not os.path.exists(target_path):
        raise FileNotFoundError(f"Coursera raw dataset not found at: {target_path}")

    logger.info("Loading Coursera dataset from %s", target_path)
    df = pd.read_csv(target_path, low_memory=False)
    logger.info("Successfully loaded %d Coursera courses.", len(df))
    return df


def load_skills_seed_data(filepath: Optional[str] = None, config: Optional[Config] = None) -> pd.DataFrame:
    """
    Loads Meerawks IT skills processed dataset.
    
    Args:
        filepath: Optional path override. If None, uses path from config.yaml.
        config: Optional Config instance.
    
    Returns:
        pd.DataFrame containing Meerawks dataset.
    """
    cfg = config or load_config()
    target_path = os.path.abspath(filepath) if filepath else cfg.raw_skills_path

    if not os.path.exists(target_path):
        raise FileNotFoundError(f"Meerawks skills seed dataset not found at: {target_path}")

    logger.info("Loading Meerawks skills dataset from %s", target_path)
    df = pd.read_csv(target_path, low_memory=False)
    logger.info("Successfully loaded %d Meerawks skill rows.", len(df))
    return df
