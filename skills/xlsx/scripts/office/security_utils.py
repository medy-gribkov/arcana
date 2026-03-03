import os
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Optional, Union

import defusedxml.ElementTree as safe_ET


def sanitize_path(
    path: Union[str, Path], 
    base_dir: Optional[Union[str, Path]] = None, 
    must_exist: bool = False
) -> Path:
    """Sanitizes a path to prevent path traversal.
    
    Args:
        path: The path to sanitize.
        base_dir: Optional base directory that the path must be within.
        must_exist: If True, raises FileNotFoundError if path doesn't exist.
        
    Returns:
        The resolved Path object.
        
    Raises:
        ValueError: If the path escapes the base directory.
        FileNotFoundError: If must_exist is True and the path is missing.
    """
    p = Path(path)
    
    # Resolve the path to handle '..' and symlinks
    try:
        if p.exists():
            resolved_p = p.resolve()
        else:
            # For non-existent paths, we resolve the parent and re-attach the name
            resolved_p = p.absolute()
    except Exception as e:
        raise ValueError(f"Invalid path: {path}. {e}")

    if must_exist and not resolved_p.exists():
        raise FileNotFoundError(f"Path does not exist: {resolved_p}")

    if base_dir:
        base = Path(base_dir).resolve()
        if not str(resolved_p).startswith(str(base)):
            raise ValueError(f"Path traversal detected: {path} is outside {base}")

    return resolved_p


def safe_parse_xml(source) -> ET.ElementTree:
    """Safely parses an XML source using defusedxml."""
    return safe_ET.parse(source)


def safe_parse_xml_string(source: str) -> ET.Element:
    """Safely parses an XML string using defusedxml."""
    return safe_ET.fromstring(source)
