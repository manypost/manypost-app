"""Generate the architecture diagram embedded in the project README.

Requirements:
    Python >= 3.9
    Graphviz
    diagrams == 0.25.1

Run from the repository root:
    python3 scripts/generate-readme-architecture.py

The committed asset was rendered with Graphviz 14.1.2. Other Graphviz versions
can produce small layout differences.
"""

from pathlib import Path

from diagrams import Cluster, Diagram, Edge
from diagrams.generic.compute import Rack
from diagrams.generic.network import Router, Switch
from diagrams.generic.storage import Storage
from diagrams.onprem.client import Client, Users
from diagrams.onprem.compute import Server
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.inmemory import Redis
from diagrams.programming.framework import Nextjs
from diagrams.programming.language import Typescript


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = REPOSITORY_ROOT / "docs" / "media" / "manypost-architecture"

GRAPH_ATTRIBUTES = {
    "bgcolor": "#FFFFFF",
    "compound": "true",
    "dpi": "144",
    "fontcolor": "#111111",
    "fontname": "Arial",
    "fontsize": "22",
    "labeljust": "l",
    "labelloc": "t",
    "newrank": "true",
    "nodesep": "0.28",
    "pad": "0.22",
    "ranksep": "0.55",
    "ratio": "compress",
    "size": "13,6!",
    "splines": "spline",
}

NODE_ATTRIBUTES = {
    "color": "#E2E2E7",
    "fillcolor": "#FFFFFF",
    "fontcolor": "#111111",
    "fontname": "Arial",
    "fontsize": "13",
    "height": "1.05",
    "margin": "0.08",
    "penwidth": "1",
    "style": "rounded,filled",
    "width": "1.15",
}

EDGE_ATTRIBUTES = {
    "arrowsize": "0.7",
    "color": "#8E8E96",
    "fontcolor": "#6B6B70",
    "fontname": "Arial",
    "fontsize": "10",
    "penwidth": "1.15",
}

CLUSTER_BASE = {
    "fontcolor": "#6B6B70",
    "fontname": "Arial",
    "fontsize": "13",
    "labeljust": "l",
    "margin": "14",
    "penwidth": "1",
    "style": "rounded,filled",
}


def cluster_attributes(background: str, border: str) -> dict[str, str]:
    """Return shared Graphviz attributes for a cluster."""

    return {
        **CLUSTER_BASE,
        "bgcolor": background,
        "color": border,
        "fillcolor": background,
        "pencolor": border,
    }


def input_cluster_attributes() -> dict[str, str]:
    """Keep entry points in one compact column."""

    return {
        **cluster_attributes("#F5F5F7", "#E2E2E7"),
        "rank": "same",
    }


def generate_diagram() -> None:
    """Render the current operational architecture as a portable PNG."""

    with Diagram(
        "manypost · arquitetura em uma visão",
        direction="LR",
        filename=str(OUTPUT_PATH),
        outformat="png",
        show=False,
        graph_attr=GRAPH_ATTRIBUTES,
        node_attr=NODE_ATTRIBUTES,
        edge_attr=EDGE_ATTRIBUTES,
    ):
        with Cluster(
            "Entradas",
            graph_attr=input_cluster_attributes(),
        ):
            teams = Users("Equipes")
            machines = Client("Automações\nREST · MCP")

        with Cluster(
            "Plataforma manypost",
            graph_attr=cluster_attributes("#F6F3FF", "#7C3AED"),
        ):
            web = Nextjs("Web")
            api = Server("API\nHono")
            core = Typescript("Core\ncasos de uso")
            jobs = Rack("Fila\npg-boss")
            worker = Server("Worker")

        with Cluster(
            "Infraestrutura e canais",
            graph_attr=cluster_attributes("#F5F5F7", "#E2E2E7"),
        ):
            database = PostgreSQL("PostgreSQL")
            coordination = Redis("Redis")
            media = Storage("Mídia\nlocal · S3")
            adapters = Switch("Providers\n16 adapters")
            networks = Router("Redes sociais")
            (
                database
                - Edge(style="invis")
                - coordination
                - Edge(style="invis")
                - media
                - Edge(style="invis")
                - adapters
                - Edge(style="invis")
                - networks
            )

        teams >> Edge(color="#7C3AED") >> web
        machines >> Edge(color="#7C3AED") >> api
        web >> Edge(color="#7C3AED") >> api

        api >> Edge(color="#7C3AED", penwidth="1.8") >> core
        core >> Edge(label="jobs") >> jobs
        jobs >> worker
        worker >> Edge(
            color="#7C3AED",
            constraint="false",
            style="dashed",
        ) >> core

        core >> database
        jobs >> Edge(
            constraint="false",
            style="dashed",
        ) >> database
        core >> coordination
        core >> media
        core >> adapters
        adapters >> Edge(color="#7C3AED", penwidth="1.8") >> networks


if __name__ == "__main__":
    generate_diagram()
