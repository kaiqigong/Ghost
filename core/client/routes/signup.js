import styleBody from 'ghost/mixins/style-body';
import loadingIndicator from 'ghost/mixins/loading-indicator';

var SignupRoute = Ember.Route.extend(styleBody, loadingIndicator, {
    classNames: ['ghost-signup'],
    beforeModel: function () {
        if (this.get('session').isAuthenticated) {
            this.notifications.showWarn('You need to sign out to register as a new user.', {delayed: true});
            this.transitionTo(SimpleAuth.Configuration.routeAfterAuthentication);
        }
    },

    model: function (params) {
        params.token = params.token.replace(/-/g, '=');
        var self = this,
            tokenText,
            email,
            model = {},
            re = /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;
        // Todo: cage: enable open register
        return new Ember.RSVP.Promise(function (resolve) {
            console.log(params);
            if (!re.test(params.token)) {
                self.notifications.showError('Invalid token.', {delayed: true});

                return resolve(self.transitionTo('signin'));
            }

            tokenText = atob(params.token);
            console.log(tokenText);
            email = tokenText.split('|')[1];

            model.email = email;
            model.token = params.token;

            return ic.ajax.request({
                url: self.get('ghostPaths.url').api('authentication', 'invitation'),
                type: 'GET',
                dataType: 'json',
                data: {
                    email: email
                }
            }).then(function (response) {
                if (response && response.invitation && response.invitation[0].valid === false) {
                    self.notifications.showError('The invitation does not exist or is no longer valid.', {delayed: true});

                    return resolve(self.transitionTo('signin'));
                }

                resolve(model);
            }).catch(function () {
                resolve(model);
            });
        });
    },

    deactivate: function () {
        this._super();

        // clear the properties that hold the sensitive data from the controller
        this.controllerFor('signup').setProperties({email: '', password: '', token: ''});
    }
});

export default SignupRoute;
