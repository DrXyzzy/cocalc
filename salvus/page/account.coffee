############################################################
# Account Settings
############################################################

{top_navbar}    = require('top_navbar')
{salvus_client} = require('salvus_client')
{alert_message} = require('alerts')
{IS_MOBILE}     = require("feature")

misc     = require("misc")
message  = require("message")
to_json  = misc.to_json
defaults = misc.defaults
required = defaults.required

set_account_tab_label = (signed_in, email_address) ->
    if signed_in
        top_navbar.pages['account'].icon = 'icon-cog'
        top_navbar.set_button_label("account", email_address)

    else
        # nothing
        top_navbar.set_button_label("account", "Sign in", "", false)

################################################
# id of account client browser thinks it is signed in as
################################################
account_id = undefined

top_navbar.on "switch_to_page-account", () ->
    if not @account_id?
        $("#sign_in-email").focus()



################################################
# Page Switching Control
################################################

focus =
    'account-sign_in'         : 'sign_in-email'
    'account-create_account'  : 'create_account-first_name'
    'account-settings'        : ''

current_account_page = null
show_page = (p) ->
    current_account_page = p
    for page, elt of focus
        if page == p
            $("##{page}").show()
            $("##{elt}").focus()
        else
            $("##{page}").hide()


show_page("account-sign_in")
#show_page("account-settings")

top_navbar.on("show_page_account", (() -> $("##{focus[current_account_page]}").focus()))

$("a[href='#account-create_account']").click (event) ->
    show_page("account-create_account")
    return false

$("a[href='#account-sign_in']").click (event) ->
    destroy_create_account_tooltips()
    show_page("account-sign_in");
    return false

################################################
# Activate buttons
################################################
$("#account-settings-change-settings-button").click (event) ->
    account_settings.load_from_view()
    account_settings.save_to_server(
        cb : (error, mesg) ->
            if error
                alert_message(type:"error", message:error)
            else
                alert_message(type:"info", message:"You have saved your settings.  Changes only apply to newly opened files and terminals.")
    )

$("#account-settings-cancel-changes-button").click((event) -> account_settings.set_view())

$("#account-settings-tab").find("form").click((event) -> return false)

#############
# Autosave
#############
$("#account-settings-autosave-slider").slider
    animate : true
    min     : 0
    max     : 300
    step    : 15
    value   : 30
    change  : (event, ui) ->
        $("#account-settings-autosave").val(ui.value)


$("#account-settings-autosave").keyup () ->
    t = $(@)
    x = t.val()
    last = t.data('last')
    if x == last
        return
    if x.length == 0
        return
    s = parseInt(x)
    if not (s >=0 and s <= 1000000)
        s = parseInt(last)
    else
        t.data('last', x)
    # Verify that input makes sense

    # Move slider as best we can
    $("#account-settings-autosave-slider").slider('value', s)

    # Set the form to whatever value we got via normalizing above (moving the slider changes the form value)
    t.val(s)

#############
# Terminal configuration
#############

$(".account-settings-terminal-font_size-slider").slider
    animate : true
    min     : 1
    max     : 100
    step    : 1
    value   : 13
    change  : (event, ui) ->
        $(".account-settings-terminal-font_size").val(ui.value)

$(".account-settings-terminal-font_size").keyup () ->
    t = $(@)
    x = t.val()
    last = t.data('last')
    if x == last
        return
    if x.length == 0
        return
    s = parseInt(x)
    if not (s >=1 and s <= 100)
        s = parseInt(last)
    else
        t.data('last', x)

    # Move slider as best we can
    $(".account-settings-terminal-font_size-slider").slider('value', s)

    # Set the form to whatever value we got via normalizing above (moving the slider changes the form value)
    t.val(s)


# Color schemes
init_color_scheme_selector = () ->
    selector = $(".account-settings-terminal-color_scheme")
    X = ([val.comment, theme] for theme, val of Terminal.color_schemes)
    X.sort()
    for x in X
        selector.append($("<option>").val(x[1]).html(x[0]))

init_color_scheme_selector()


################################################
# Tooltips
################################################

enable_tooltips = () ->
    if IS_MOBILE
        # never enable on mobile -- they are totally broken
        return
    $("[rel=tooltip]").tooltip
        delay: {show: 1000, hide: 100}
        placement: 'right'

disable_tooltips = () ->
    $("[rel=tooltip]").tooltip("destroy")

################################################
# Account creation
################################################

create_account_fields = ['first_name', 'last_name', 'email_address', 'password', 'agreed_to_terms']

destroy_create_account_tooltips = () ->
    for field in create_account_fields
        $("#create_account-#{field}").popover("destroy")

top_navbar.on("switch_from_page-account", destroy_create_account_tooltips)

$("#create_account-button").click((event) ->
    destroy_create_account_tooltips()

    opts = {}
    for field in create_account_fields
        elt = $("#create_account-#{field}")
        if elt[0].type == "checkbox"
            v = elt.is(":checked")
        else
            v = elt.val()
        opts[field] = v

    opts.cb = (error, mesg) ->
        if error
            alert_message(type:"error", message: "There was an unexpected error trying to create a new account.  Please try again later.")
            return
        switch mesg.event
            when "account_creation_failed"
                for key, val of mesg.reason
                    $("#create_account-#{key}").popover(
                        title     : val
                        animation : false
                        trigger   : "manual"
                        placement : if $(window).width() <= 800 then "top" else "left"
                        template: '<div class="popover popover-create-account"><div class="arrow"></div><div class="popover-inner"><h3 class="popover-title"></h3></div></div>'  # using template -- see https://github.com/twitter/bootstrap/pull/2332
                    ).popover("show").focus( () -> $(@).popover("destroy"))
            when "signed_in"
                alert_message(type:"success", message: "Account created!  You are now signed in as #{mesg.first_name} #{mesg.last_name}.")
                signed_in(mesg)
            else
                # should never ever happen
                alert_message(type:"error", message: "The server responded with invalid message to account creation request: #{JSON.stringify(mesg)}")

    salvus_client.create_account(opts)
)


# Enhance HTML element to display feedback about a choice of password
#     input   -- jQuery wrapped <input> element where password is typed
password_strength_meter = (input) ->
    # TODO: move this html into account.html
    display = $('<div class="progress progress-striped"><div class="bar"></div>&nbsp;<font size=-1></font></div>')
    input.after(display)
    colors = ['red', 'yellow', 'orange', 'lightgreen', 'green']
    score = ['Very weak', 'Weak', 'So-so', 'Good', 'Awesome!']
    input.bind('change keypress paste focus textInput input', () ->
        result = zxcvbn(input.val(), ['sagemath'])  # explicitly ban some words.
        display.find(".bar").css("width", "#{13*(result.score+1)}%")
        display.find("font").html(score[result.score])
        display.css("background-color", colors[result.score])
    )
    return input

$.fn.extend
    password_strength_meter: (options) ->
        settings = {}
        settings = $.extend settings, options
        return @each () ->
            password_strength_meter($(this))

$('.salvus-password-meter').password_strength_meter()

################################################
# Sign in
################################################

$("#sign_in-form").submit((event) -> sign_in(); return false)

$("#sign_in-button").click((event) -> sign_in(); return false)

sign_in = () ->
    $("#sign_in-email").focus()
    salvus_client.sign_in
        email_address : $("#sign_in-email").val()
        password      : $("#sign_in-password").val()
        remember_me   : $("#sign_in-remember_me").is(":checked")
        timeout       : 10
        cb            : (error, mesg) ->
            if error
                alert_message(type:"error", message: "There was an unexpected error during sign in.  Please try again later. #{error}")
                return
            switch mesg.event
                when 'sign_in_failed'
                    alert_message(type:"error", message: mesg.reason)
                when 'signed_in'
                    signed_in(mesg)
                when 'error'
                    alert_message(type:"error", message: mesg.reason)
                else
                    # should never ever happen
                    alert_message(type:"error", message: "The server responded with invalid message when signing in: #{JSON.stringify(mesg)}")

first_login = true
signed_in = (mesg) ->
    # Record which hub we're connected to.
    $("#connection_bars").find("i").tooltip(title:"Hub: #{mesg.hub}", delay:1000, placement:'left')

    # Record account_id in a variable global to this file, and pre-load and configure the "account settings" page
    account_id = mesg.account_id
    account_settings.load_from_server (error) ->
        if error
            alert_message(type:"error", message:error)
        else
            account_settings.set_view()
            # change the view in the account page to the settings/sign out view
            show_page("account-settings")
            # change the navbar title from "Sign in" to their email address
            set_account_tab_label(true, mesg.email_address)
            top_navbar.show_page_button("projects")

            #####
            # DISABLE worksheet1 -- enable this maybe when finishing worksheets port
            #
            #top_navbar.show_page_button("worksheet1")
            # Load the default worksheet (for now)
            #require('worksheet1').load_scratch_worksheet()

            # If this is the initial login, switch to the project
            # page.  We do this because if the user's connection is
            # flakie, they might get dropped and re-logged-in multiple
            # times, and we definitely don't want to switch to the
            # projects page in that case.  Also, if they explicitly
            # log out, then log back in as another user, seeing
            # the account page by default in that case makes sense.
            if first_login and top_navbar.current_page_id == 'account'
                first_login = false
                top_navbar.switch_to_page("projects")

# Listen for pushed sign_in events from the server.  This is one way that
# the sign_in function above can be activated, but not the only way.
salvus_client.on("signed_in", signed_in)

################################################
# Explicit sign out
################################################
sign_out = () ->

    # require('worksheet1').close_scratch_worksheet()
    $("#connection_bars").find("i").tooltip('destroy')

    # Send a message to the server that the user explicitly
    # requested to sign out.  The server can clean up resources
    # and invalidate the remember_me cookie for this client.
    salvus_client.sign_out
        timeout : 10
        cb      : (error) ->
            if error
                alert_message(type:"error", message:error)
            else
                # Force a refresh, since otherwise there could be data
                # left in the DOM, which could lead to a vulnerability
                # or blead into the next login somehow.
                window.location.reload(false)

    return false


$("#account").find("a[href=#sign-out]").click(sign_out)

################################################
# Account settings
################################################

EDITOR_SETTINGS_CHECKBOXES = ['strip_trailing_whitespace', 'line_wrapping',
                              'line_numbers', 'smart_indent', 'match_brackets', 'electric_chars']

class AccountSettings
    load_from_server: (cb) ->
        salvus_client.get_account_settings
            account_id : account_id
            cb         : (error, settings_mesg) =>
                if error
                    alert_message(type:"error", message:"Error loading account settings - #{error}")
                    @settings = 'error'
                    cb(error)
                    return


                if settings_mesg.event != "account_settings"
                    alert_message(type:"error", message:"Received an invalid message back from the server when requesting account settings.  mesg=#{JSON.stringify(settings_mesg)}")
                    cb("invalid message")
                    return

                @settings = settings_mesg
                delete @settings['id']
                delete @settings['event']

                cb()

    git_author: () =>
        return misc.git_author(@settings.first_name, @settings.last_name, @settings.email_address)

    fullname: () =>
        return @settings.first_name + " " + @settings.last_name

    load_from_view: () ->
        if not @settings? or @settings == "error"
            return  # not logged in -- don't bother

        for prop of @settings
            element = $("#account-settings-#{prop}")
            switch prop
                when 'email_maintenance', 'email_new_features', 'enable_tooltips'
                    val = element.is(":checked")
                when 'connect_Github', 'connect_Google', 'connect_Dropbox'
                    val = (element.val() == "unlink")
                when 'autosave'
                    val = parseInt(element.val())
                    if not (val >= 0 and val <= 1000000)
                        val = 30
                when 'terminal'
                    val = {}
                    # font_size
                    font_size = parseInt($(".account-settings-terminal-font_size").val())
                    if not (font_size >= 1 and font_size <= 100)
                        font_size = 12
                    val.font_size = font_size

                    # color scheme
                    val.color_scheme = $(".account-settings-terminal-color_scheme").val()

                    # Terminal font
                    val.font = $(".account-settings-terminal-font").val()

                when 'editor_settings'
                    val = {}

                    # Checkbox options
                    for x in EDITOR_SETTINGS_CHECKBOXES
                        val[x] = element.find(".account-settings-#{x}").is(":checked")

                    # Keyboard bindings
                    val.bindings = element.find(".account-settings-editor-bindings").val()


                else
                    val = element.val()


            # There are a number of settings that aren't yet implemented in the GUI...
            if typeof(val) == "object"
                val = misc.defaults(val, message.account_settings_defaults[prop])

            @settings[prop] = val


    set_view: () ->
        if not @settings?
            return  # not logged in -- don't bother

        if @settings == 'error'
            $("#account-settings-error").show()
            return

        set = (element, value) ->
            # TODO: dumb and dangerous -- do better
            element.val(value)
            element.text(value)


        $("#account-settings-error").hide()

        for prop, value of @settings
            def = message.account_settings_defaults[prop]
            if typeof(def) == "object"
                if not value?
                    value = {}
                @settings[prop] = value = misc.defaults(value, def)

            element = $("#account-settings-#{prop}")
            switch prop
                when 'enable_tooltips'
                    element.attr('checked', value)
                    if value
                        enable_tooltips()
                    else
                        disable_tooltips()
                when 'email_maintenance', 'email_new_features'
                    element.attr('checked', value)
                when 'evaluate_key'
                    element.val(value)
                    if element.val() == null
                        element.val("Shift-Enter")  # backwards compatibility
                when 'default_system'
                    element.val(value)
                    $("#demo1-system").val(value)
                    $("#demo2-system").val(value)
                when 'connect_Github', 'connect_Google', 'connect_Dropbox'
                    set(element, if value then "unlink" else "Connect to #{prop.slice(8)}")
                when 'support_level'
                    element.text(value)
                    $("#feedback-support-level").text(value)
                when 'autosave'
                    $("#account-settings-autosave-slider").slider('value', value)
                    $("#account-settings-autosave").val(value)
                when 'terminal'
                    if value.font_size?
                        $(".account-settings-terminal-font_size-slider").slider('value', value.font_size)
                        $(".account-settings-terminal-font_size").val(value.font_size)
                        $(".account-settings-terminal-color_scheme").val(value.color_scheme)
                        if not value.font?
                            value.font = 'droid-sans-mono'
                        $(".account-settings-terminal-font").val(value.font)
                when 'editor_settings'
                    for x in EDITOR_SETTINGS_CHECKBOXES
                        element.find(".account-settings-#{x}").prop("checked", value[x])
                    element.find(".account-settings-editor-bindings").val(value.bindings)
                else
                    set(element, value)

        set_account_tab_label(true, @settings.email_address)

    # Store the properties that user can freely change to the backend database.
    # The other properties only get saved by direct api calls that require additional
    # information, e.g., password.   The setting in this object are saved; if you
    # want to save the settings in view, you must first call load_from_view.
    save_to_server: (opts) ->
        opts = defaults opts,
            cb       : required
            password : undefined  # must be set, or all restricted settings are ignored by the server

        if not @settings? or @settings == 'error'
            opts.cb("There are no account settings to save.")
            return

        salvus_client.save_account_settings
            account_id : account_id
            settings   : @settings
            password   : opts.password
            cb         : opts.cb

account_settings = exports.account_settings = new AccountSettings()

################################################
# Change Email Address
################################################

change_email_address = $("#account-change_email_address")

$("a[href='#account-change_email_address']").click((event)->$('#account-change_email_address').modal('show'))  # should not be needed

close_change_email_address = () ->
    change_email_address.modal('hide').find('input').val('')
    change_email_address.find(".account-error-text").hide()

# When click in the cancel button on the change email address
# dialog, it is important to hide an error messages; also clear
# password.
change_email_address.find(".close").click((event) -> close_change_email_address())
$("#account-change_email_address_cancel_button").click((event)->close_change_email_address())

change_email_address.on("shown", () -> $("#account-change_email_new_address").focus())

# User clicked button to change the email address, so try to
# change it.
$("#account-change_email_address_button").click (event) ->
    new_email_address = $("#account-change_email_new_address").val()
    password = $("#account-change_email_password").val()

    salvus_client.change_email
        old_email_address : account_settings.settings.email_address
        new_email_address : new_email_address
        password          : password
        account_id        : account_settings.settings.account_id
        cb                : (error, mesg) ->
            $("#account-change_email_address").find(".account-error-text").hide()
            if error  # exceptional condition -- some sort of server or connection error
                alert_message(type:"error", message:error)
                close_change_email_address() # kill modal (since this is a weird error condition)
                return
            if mesg.error
                x = $("#account-change_email_address-#{mesg.error}")
                if x.length == 0
                    # this should not happen
                    alert_message(type:"error", message:"Email change error: #{mesg.error}")
                    close_change_email_address()
                else
                    x.show()
                    if mesg.error == 'too_frequent' and mesg.ttl
                        x.find("span").html(" #{mesg.ttl } seconds ")
                        setTimeout((() -> x.hide()), mesg.ttl*1000)
                    $("#account-change_email_password").val(password)
            else
                # success
                $("#account-settings-email_address").html(new_email_address)
                account_settings.settings.email_address = new_email_address
                set_account_tab_label(true, new_email_address)
                close_change_email_address()
    return false

################################################
# Change password
################################################

change_password = $("#account-change_password")

close_change_password = () ->
    change_password.modal('hide').find('input').val('')
    change_password.find(".account-error-text").hide()

change_password.find(".close").click((event) -> close_change_password())
$("#account-change_password-button-cancel").click((event)->close_change_password())
change_password.on("shown", () -> $("#account-change_password-old_password").focus())

$("a[href='#account-change_password']").click((event)->$('#account-change_password').modal('show'))  # should not be needed

$("#account-change_password-button-submit").click (event) ->
    salvus_client.change_password
        email_address : account_settings.settings.email_address
        old_password  : $("#account-change_password-old_password").val()
        new_password  : $("#account-change_password-new_password").val()
        cb : (error, mesg) ->
            if error
                $("#account-change_password-error").html("Error communicating with server: #{error}")
            else
                change_password.find(".account-error-text").hide()
                if mesg.error
                    # display errors
                    for key, val of mesg.error
                        x = $("#account-change_password-error-#{key}")
                        if x.length == 0
                            x = $("#account-change_password-error")
                        x.html(val)
                        x.show()
                else
                    # success
                    alert_message(type:"info", message:"You have changed your password.")
                    close_change_password()
    return false

################################################
# Forgot your password?
################################################

forgot_password = $("#account-forgot_password")
$("a[href='#account-forgot_password']").click((event) -> forgot_password.modal())

close_forgot_password = () ->
    forgot_password.modal('hide').find('input').val('')
    forgot_password.find(".account-error-text").hide()

forgot_password.find(".close").click((event) -> close_forgot_password())
$("#account-forgot_password-button-cancel").click((event)->close_forgot_password())
forgot_password.on("shown", () -> $("#account-forgot_password-email_address").focus())

$("#account-forgot_password-button-submit").click (event) ->
    email_address = $("#account-forgot_password-email_address").val()
    forgot_password.find(".account-error-text").hide()
    salvus_client.forgot_password
        email_address : email_address
        cb : (error, mesg) ->
            if error
                alert_message(type:"error", message:"Error sending password reset message to '#{email_address}'. #{mesg.error}")
            else if mesg.error
                alert_message(type:"error", message:"Error sending password reset message to '#{email_address}'. #{mesg.error}")
            else
                alert_message(type:"info", message:"Salvus sent a password reset email message to #{email_address}.")


#################################################################
# Page you get when you click "Forgot your password" email link and main page loads
#################################################################
forgot_password_reset = $("#account-forgot_password_reset")
url_args = window.location.href.split("#")
if url_args.length == 3 and url_args[1] == "forgot"
    forget_password_reset_key = url_args[2]
    forgot_password_reset.modal("show")

close_forgot_password_reset = () ->
    forgot_password_reset.modal('hide').find('input').val('')
    forgot_password_reset.find(".account-error-text").hide()

forgot_password_reset.find(".close").click((event) -> close_forgot_password_reset())
$("#account-forgot_password_reset-button-cancel").click((event)->close_forgot_password_reset())
forgot_password_reset.on("shown", () -> $("#account-forgot_password_reset-new_password").focus())

$("#account-forgot_password_reset-button-submit").click (event) ->
    new_password = $("#account-forgot_password_reset-new_password").val()
    forgot_password_reset.find(".account-error-text").hide()
    salvus_client.reset_forgot_password
        reset_code   : url_args[2]
        new_password : new_password
        cb : (error, mesg) ->
            if error
                $("#account-forgot_password_reset-error").html("Error communicating with server: #{error}").show()
            else
                if mesg.error
                    $("#account-forgot_password_reset-error").html(mesg.error).show()
                else
                    # success
                    alert_message(type:"info", message:'Your new password has been saved.')
                    close_forgot_password_reset()
                    window.history.pushState("", "", "/") # get rid of the hash-tag in URL (requires html5 to work, but doesn't matter if it doesn't work)
    return false



################################################
# Upgrade account
################################################
$("a[href='#account-settings-upgrade']").click (event) ->
    alert_message(type:'error', message:"Only free accounts are currently available.")
    return false


################################################
# Version number check
################################################
client_version = require('salvus_version').version  # client version

version_check = () ->
    salvus_client.server_version
        cb : (err, server_version) ->
            if not err and server_version > client_version
                $(".salvus_client_version_warning").show()

$(".salvus_client_version_warning").draggable().find(".icon-remove").click () ->
    $(".salvus_client_version_warning").hide()

setInterval(version_check, 3*60*1000)  # check once every three minutes; may increase time later as usage grows (?)

