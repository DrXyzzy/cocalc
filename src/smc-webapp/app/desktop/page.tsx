/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

/* This defines the entire Cocalc page layout and brings in
everything on *desktop*, once the user has signed in.

*/

declare var DEBUG: boolean;

// TODO:
const { ProjectsNav } = require("../../projects_nav");
const { Support } = require("../../support");

import { COLORS } from "smc-util/theme";

import { Button, Navbar, Nav, NavItem } from "../../antd-bootstrap";
import {
  React,
  useActions,
  useEffect,
  useState,
  useRedux,
} from "../../app-framework";
import { SiteName } from "../../customize";
import { alert_message } from "../../alerts";
import { NavTab } from "../nav-tab";
import { ErrorBoundary, Loading } from "../../r_misc";
import { ActiveContent } from "../active-content";
import { FullscreenButton } from "../fullscreen-button";
import {
  VersionWarning,
  CookieWarning,
  LocalStorageWarning,
} from "../warnings";
import { AppLogo } from "../logo";
import { ConnectionInfo } from "../connection-info";
import { ConnectionIndicator } from "../connection-indicator";
import { FileUsePage } from "../../file-use/page";
import { NotificationBell } from "../notification-bell";

const HIDE_LABEL_THRESHOLD = 6;
const NAV_HEIGHT = 36;
const NAV_CLASS = "hidden-xs";

const TOP_BAR_STYLE: React.CSSProperties = {
  display: "flex",
  marginBottom: 0,
  width: "100%",
  minHeight: `${NAV_HEIGHT}px`,
  position: "fixed",
  right: 0,
  zIndex: 100,
  borderRadius: 0,
  top: 0,
} as const;

const FILE_USE_STYLE: React.CSSProperties = {
  zIndex: 10,
  marginLeft: "0",
  position: "fixed",
  boxShadow: "0 0 15px #aaa",
  border: "2px solid #ccc",
  top: `${NAV_HEIGHT - 2}px`,
  background: "#fff",
  right: "2em",
  overflowY: "auto",
  overflowX: "hidden",
  fontSize: "10pt",
  padding: "4px",
  borderRadius: "5px",
  width: "50%",
  height: "90%",
} as const;

const PROJECTS_STYLE: React.CSSProperties = {
  whiteSpace: "nowrap",
  float: "right",
  padding: "10px 7px",
} as const;

const PAGE_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100vh",
  width: "100vw",
  overflow: "hidden",
  background: "white",
} as const;

const positionHackHeight = NAV_HEIGHT - 26 + "px";

export const Page: React.FC = () => {
  const [show_label, set_show_label] = useState<boolean>(true);
  const page_actions = useActions("page");
  const account_actions = useActions("account");
  const support_actions = useActions("support");

  useEffect(() => {
    const next = open_projects.size <= HIDE_LABEL_THRESHOLD;
    if (next != show_label) {
      set_show_label(next);
    }
  }, [open_projects]);

  useEffect(() => {
    return () => {
      page_actions.clear_all_handlers();
    };
  }, []);

  const open_projects = useRedux(["projects", "open_projects"]);
  const active_top_tab = useRedux(["page", "active_top_tab"]);
  const show_connection = useRedux(["page", "show_connection"]);
  const show_file_use = useRedux(["page", "show_file_use"]);
  const fullscreen = useRedux(["page", "fullscreen"]);
  const local_storage_warning = useRedux(["page", "local_storage_warning"]);
  const cookie_warning = useRedux(["page", "cookie_warning"]);
  const new_version = useRedux(["page", "new_version"]);

  const show_support = useRedux(["support", "show"]);

  const account_id = useRedux(["account", "account_id"]);
  const is_logged_in = useRedux(["account", "is_logged_in"]);
  const is_anonymous = useRedux(["account", "is_anonymous"]);
  const doing_anonymous_setup = useRedux(["account", "doing_anonymous_setup"]);
  const when_account_created = useRedux(["account", "created"]);
  const groups = useRedux(["account", "groups"]);

  const is_commercial = useRedux(["customize", "is_commercial"]);

  function render_account_tab(): JSX.Element {
    let a, label, style;
    if (is_anonymous) {
      a = undefined;
    } else if (account_id) {
      a = (
        <Avatar
          size={20}
          account_id={account_id}
          no_tooltip={true}
          no_loading={true}
        />
      );
    } else {
      a = "cog";
    }

    if (is_anonymous) {
      let mesg;
      style = { fontWeight: "bold", opacity: 0 };
      if (
        when_account_created &&
        new Date().valueOf() - when_account_created.valueOf() >=
          1000 * 60 * 60 * 24 * 3
      ) {
        mesg = "Sign Up NOW to avoid losing all of your work!";
        style.width = "400px";
      } else {
        mesg = "Sign Up";
      }
      label = (
        <Button id="anonymous-sign-up" bsStyle="success" style={style}>
          {mesg}
        </Button>
      );
      style = { marginTop: "-10px" }; // compensate for using a button
      /* We only actually show the button if it is still there a few
        seconds later.  This avoids flickering it for a moment during
        normal sign in.  This feels like a hack, but was super
        quick to implement.
      */
      setTimeout(() => $("#anonymous-sign-up").css("opacity", 1), 3000);
    } else {
      label = "Account";
      style = undefined;
    }

    return (
      <NavTab
        name="account"
        label={label}
        style={style}
        label_class={NAV_CLASS}
        icon={a}
        actions={page_actions}
        active_top_tab={active_top_tab}
        hide_label={!show_label}
      />
    );
  }

  function render_admin_tab(): JSX.Element {
    return (
      <NavTab
        name="admin"
        label={"Admin"}
        label_class={NAV_CLASS}
        icon={"users"}
        inner_style={{ padding: "10px", display: "flex" }}
        actions={page_actions}
        active_top_tab={active_top_tab}
        hide_label={!show_label}
      />
    );
  }

  function sign_in_tab_clicked() {
    if (active_top_tab === "account") {
      page_actions.sign_in();
    }
  }

  function render_sign_in_tab(): JSX.Element {
    let style;
    if (active_top_tab !== "account") {
      // Strongly encourage clicking on the sign in tab.
      // Especially important if user got signed out due
      // to cookie expiring or being deleted (say).
      style = { backgroundColor: COLORS.TOP_BAR.SIGN_IN_BG, fontSize: "16pt" };
    } else {
      style = undefined;
    }
    return (
      <NavTab
        name="account"
        label="Sign in"
        label_class={NAV_CLASS}
        icon="sign-in"
        inner_style={{ padding: "10px", display: "flex" }}
        on_click={this.sign_in_tab_clicked}
        actions={page_actions}
        active_top_tab={active_top_tab}
        style={style}
        add_inner_style={{ color: "black" }}
        hide_label={!show_label}
      />
    );
  }

  function render_support(): JSX.Element {
    if (!is_commercial) {
      return;
    }
    return (
      <NavTab
        label={"Help"}
        label_class={NAV_CLASS}
        icon={"medkit"}
        inner_style={{ padding: "10px", display: "flex" }}
        actions={page_actions}
        active_top_tab={active_top_tab}
        on_click={() => support_actions.show(true)}
        hide_label={!show_label}
      />
    );
  }

  function render_bell(): JSX.Element | undefined {
    if (!is_logged_in || is_anonymous) {
      return;
    }
    return <NotificationBell active={show_file_use} />;
  }

  function render_right_nav(): JSX.Element {
    const logged_in = is_logged_in;
    return (
      <Nav
        id="smc-right-tabs-fixed"
        style={{
          height: `${NAV_HEIGHT}px`,
          lineHeight: "20px",
          margin: "0",
          overflowY: "hidden",
        }}
      >
        {logged_in && groups?.includes("admin") && render_admin_tab()}
        {!logged_in && render_sign_in_tab()}
        <NavTab
          name={"about"}
          label={<SiteName />}
          label_class={NAV_CLASS}
          icon={"info-circle"}
          inner_style={{ padding: "10px", display: "flex" }}
          active_top_tab={active_top_tab}
          hide_label={!show_label}
        />
        <NavItem className="divider-vertical hidden-xs" />
        {render_support()}
        {logged_in && render_account_tab()}
        {render_bell()}
        {!is_anonymous && <ConnectionIndicator />}
      </Nav>
    );
  }

  function render_project_nav_button(): JSX.Element {
    return (
      <Nav
        style={{ height: `${NAV_HEIGHT}px`, margin: "0", overflow: "hidden" }}
      >
        <NavTab
          name={"projects"}
          inner_style={{ padding: "0px" }}
          active_top_tab={active_top_tab}
        >
          {show_label && !is_anonymous && (
            <div
              style={PROJECTS_STYLE}
              cocalc-test="project-button"
              className={NAV_CLASS}
            >
              Projects
            </div>
          )}
          <AppLogo />
        </NavTab>
      </Nav>
    );
  }

  // register a default drag and drop handler, that prevents
  // accidental file drops
  // TEST: make sure that usual drag'n'drop activities
  // like rearranging tabs and reordering tasks work
  function drop(e) {
    if (DEBUG) {
      e.persist();
    }
    //console.log "react desktop_app.drop", e
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length > 0) {
      alert_message({
        type: "info",
        title: "File Drop Rejected",
        message:
          'To upload a file, drop it onto the files listing or the "Drop files to upload" area in the +New tab.',
      });
    }
  }

  if (doing_anonymous_setup) {
    // Don't show the login screen or top navbar for a second
    // while creating their anonymous account, since that
    // would just be ugly/confusing/and annoying.
    // Have to use above style to *hide* the crash warning.
    const loading_anon = (
      <div style={{ margin: "auto", textAlign: "center" }}>
        <h1 style={{ color: COLORS.GRAY }}>
          <Loading />
        </h1>
        <div style={{ color: COLORS.GRAY_L, width: "50vw" }}>
          Please give <SiteName /> a couple of seconds to start your project and
          prepare a file...
        </div>
      </div>
    );
    return <div style={PAGE_STYLE}>{loading_anon}</div>;
  }

  // Children must define their own padding from navbar and screen borders
  // Note that the parent is a flex container
  return (
    <div
      style={PAGE_STYLE}
      onDragOver={(e) => e.preventDefault()}
      onDrop={drop}
    >
      {show_file_use && (
        <div style={FILE_USE_STYLE} className="smc-vfill">
          <FileUsePage />
        </div>
      )}
      {show_connection && <ConnectionInfo />}
      {show_support && <Support actions={support_actions} />}
      {new_version && <VersionWarning new_version={new_version} />}
      {cookie_warning && <CookieWarning />}
      {local_storage_warning && <LocalStorageWarning />}
      {!fullscreen && (
        <Navbar className="smc-top-bar" style={TOP_BAR_STYLE}>
          {is_logged_in && !is_anonymous && render_project_nav_button()}
          <ProjectsNav dropdown={false} />
          {render_right_nav()}
        </Navbar>
      )}
      {!fullscreen && <div style={{ minHeight: positionHackHeight }}></div>}
      {fullscreen !== "kiosk" && !is_anonymous && <FullscreenButton />}
      <ErrorBoundary>
        <ActiveContent />
      </ErrorBoundary>
    </div>
  );
};