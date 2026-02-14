/** @odoo-module **/
import { Component } from "@odoo/owl";
import { registry } from "@web/core/registry";

class LiveMarketBackend extends Component {
    static template = "iroom_dashboard.live_market_template";
}

registry.category("actions").add("iroom_dashboard.live_market", LiveMarketBackend);